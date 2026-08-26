package com.healthcare.consultation.service;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** PostgreSQL proof for cleanup lease expiry and the retry-attempt ceiling. */
class ConsultationAttachmentObjectCleanupWorkerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void expiredLeaseAtAttemptCeilingBecomesTerminalAndCannotBeReclaimed() {
        String objectKey = "private/consultations/test/verified/terminal-object";
        jdbcTemplate.update("""
            INSERT INTO patient_consultation_object_cleanup
                (object_key, status, attempts, next_attempt_at, lease_token, lease_expires_at)
            VALUES (?, 'PROCESSING', 20, CURRENT_TIMESTAMP - INTERVAL '1 minute',
                    gen_random_uuid(), CURRENT_TIMESTAMP - INTERVAL '1 second')
            """, objectKey);

        ConsultationAttachmentObjectCleanupWorker worker = worker();
        worker.claimOne(new SimpleTransactionStatus());

        Map<String, Object> row = jdbcTemplate.queryForMap("""
            SELECT status, attempts, lease_token, lease_expires_at, last_failure_code
              FROM patient_consultation_object_cleanup WHERE object_key = ?
            """, objectKey);
        assertThat(row.get("status")).isEqualTo("FAILED");
        assertThat(row.get("attempts")).isEqualTo(20);
        assertThat(row.get("lease_token")).isNull();
        assertThat(row.get("lease_expires_at")).isNull();
        assertThat(row.get("last_failure_code"))
            .isEqualTo("ATTACHMENT_OBJECT_CLEANUP_LEASE_EXPIRED");

        worker.claimOne(new SimpleTransactionStatus());
        assertThat(jdbcTemplate.queryForObject("""
            SELECT count(*) FROM patient_consultation_object_cleanup
             WHERE object_key = ? AND status = 'PROCESSING'
            """, Integer.class, objectKey)).isZero();
    }

    @Test
    void expiredLeaseBelowAttemptCeilingConsumesAnotherAttempt() {
        String objectKey = "private/consultations/test/verified/reclaim-object";
        jdbcTemplate.update("""
            INSERT INTO patient_consultation_object_cleanup
                (object_key, status, attempts, next_attempt_at, lease_token, lease_expires_at)
            VALUES (?, 'PROCESSING', 19, CURRENT_TIMESTAMP - INTERVAL '1 minute',
                    gen_random_uuid(), CURRENT_TIMESTAMP - INTERVAL '1 second')
            """, objectKey);

        worker().claimOne(new SimpleTransactionStatus());

        Map<String, Object> row = jdbcTemplate.queryForMap("""
            SELECT status, attempts, lease_token, lease_expires_at
              FROM patient_consultation_object_cleanup WHERE object_key = ?
            """, objectKey);
        assertThat(row.get("status")).isEqualTo("PROCESSING");
        assertThat(row.get("attempts")).isEqualTo(20);
        assertThat(row.get("lease_token")).isNotNull();
        assertThat(row.get("lease_expires_at")).isNotNull();
    }

    private ConsultationAttachmentObjectCleanupWorker worker() {
        return new ConsultationAttachmentObjectCleanupWorker(
            jdbcTemplate,
            mock(ConsultationAttachmentStorage.class),
            transactionManager,
            true,
            120);
    }
}
