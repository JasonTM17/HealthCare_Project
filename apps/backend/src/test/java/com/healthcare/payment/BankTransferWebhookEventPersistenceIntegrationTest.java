package com.healthcare.payment;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.payment.service.BankTransferWebhookService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * A bank notification that arrives before the patient ever opened the payment
 * panel (no payment row yet) must still be persisted as unprocessed evidence
 * instead of being rolled away with the failed match.
 */
class BankTransferWebhookEventPersistenceIntegrationTest extends AbstractIntegrationTest {

    private static final String SECRET = "test-only-payment-webhook-secret-at-least-32-chars";

    @Autowired
    private BankTransferWebhookService webhookService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void unmatchedWebhookEventSurvivesTheFailedMatch() {
        String eventId = "evt-before-init-" + UUID.randomUUID();
        String rawBody = "{\"transferContent\":\"UNMATCHED " + eventId.substring(eventId.length() - 8)
            + " DIGIT\",\"amount\":150000,\"transactionReference\":\"FT-UNMATCHED-0001\"}";
        long timestamp = Instant.now().getEpochSecond();
        String signature = sign(timestamp, rawBody);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> webhookService.process(eventId, Long.toString(timestamp), signature, rawBody));
        assertEquals(404, ex.getStatusCode().value());

        Integer persisted = jdbcTemplate.queryForObject(
            "select count(*) from payment_webhook_events where event_id = ? and payment_id is null and processed_at is null",
            Integer.class,
            eventId
        );
        assertNotNull(persisted);
        assertEquals(1, persisted);
    }

    private static String sign(long timestamp, String rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(
                mac.doFinal((timestamp + "." + rawBody).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
