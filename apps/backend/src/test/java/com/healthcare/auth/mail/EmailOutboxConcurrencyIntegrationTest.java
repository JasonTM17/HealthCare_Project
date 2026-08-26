package com.healthcare.auth.mail;

import com.healthcare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** PostgreSQL proof that the unique idempotency key is the write authority. */
class EmailOutboxConcurrencyIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private EmailOutboxService outbox;

    @Autowired
    private EmailOutboxRepository repository;

    @Test
    void concurrentSameKeyEnqueueReturnsOneDurableEnvelope() throws Exception {
        String key = "concurrent-booking-" + UUID.randomUUID();
        UUID eventReferenceId = UUID.randomUUID();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<UUID> first = executor.submit(() -> enqueueAfter(start, ready, key, eventReferenceId));
            Future<UUID> second = executor.submit(() -> enqueueAfter(start, ready, key, eventReferenceId));
            ready.await();
            start.countDown();

            UUID firstId = first.get();
            UUID secondId = second.get();
            assertEquals(firstId, secondId);
            assertEquals(1, jdbcTemplate.queryForObject(
                "select count(*) from email_outbox where idempotency_key = ?", Integer.class, key));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @Transactional
    void databaseTimeFencesSentAndExpiresSlowClaims() {
        UUID id = outbox.enqueue(
            EmailTemplateKey.BOOKING_OTP,
            "patient@example.test",
            Map.of("code", "123456", "minutes", "5"),
            "fence-sent-" + UUID.randomUUID(),
            null,
            UUID.randomUUID(),
            "BOOKING_OTP",
            900
        ).getId();
        UUID lease = UUID.randomUUID();
        jdbcTemplate.update("""
            UPDATE email_outbox
            SET status = 'PROCESSING', lease_token = ?,
                lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
                expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
            WHERE id = ?
            """, lease, id);

        assertTrue(repository.isLeaseActive(id, lease));
        assertEquals(1, repository.markSentIfLeaseActive(id, lease));
        assertEquals("SENT", jdbcTemplate.queryForObject(
            "select status from email_outbox where id = ?", String.class, id));
        assertNotNull(jdbcTemplate.queryForObject(
            "select sent_at from email_outbox where id = ?", Object.class, id));

        UUID expiredId = outbox.enqueue(
            EmailTemplateKey.BOOKING_OTP,
            "patient@example.test",
            Map.of("code", "654321", "minutes", "5"),
            "fence-expired-" + UUID.randomUUID(),
            null,
            UUID.randomUUID(),
            "BOOKING_OTP",
            900
        ).getId();
        UUID expiredLease = UUID.randomUUID();
        jdbcTemplate.update("""
            UPDATE email_outbox
            SET status = 'PROCESSING', lease_token = ?,
                created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes',
                available_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes',
                lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
                expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
            WHERE id = ?
            """, expiredLease, expiredId);

        assertEquals(0, repository.markSentIfLeaseActive(expiredId, expiredLease));
        assertEquals(1, repository.markExpiredIfLeaseActive(expiredId, expiredLease));
        assertEquals("EXPIRED", jdbcTemplate.queryForObject(
            "select status from email_outbox where id = ?", String.class, expiredId));
    }

    private UUID enqueueAfter(CountDownLatch start, CountDownLatch ready, String key,
                              UUID eventReferenceId) throws Exception {
        ready.countDown();
        start.await();
        return outbox.enqueue(
            EmailTemplateKey.BOOKING_OTP,
            "patient@example.test",
            Map.of("code", "123456", "minutes", "5"),
            key,
            null,
            eventReferenceId,
            "BOOKING_OTP",
            900
        ).getId();
    }
}
