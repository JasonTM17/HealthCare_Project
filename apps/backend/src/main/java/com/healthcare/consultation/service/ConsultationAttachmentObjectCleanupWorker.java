package com.healthcare.consultation.service;

import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Drains the DB-authoritative consultation object cleanup queue. The worker
 * never logs object keys and uses a lease token so a restarted instance cannot
 * acknowledge another worker's delete.
 */
@Component
public class ConsultationAttachmentObjectCleanupWorker {
    private static final int MAX_ATTEMPTS = 20;
    private final JdbcTemplate jdbc;
    private final ConsultationAttachmentStorage storage;
    private final TransactionTemplate transactions;
    private final boolean enabled;
    private final int leaseSeconds;

    public ConsultationAttachmentObjectCleanupWorker(
            JdbcTemplate jdbc,
            ConsultationAttachmentStorage storage,
            PlatformTransactionManager transactionManager,
            @Value("${storage.consultation.worker-enabled:false}") boolean enabled,
            @Value("${storage.consultation.scan-lease-seconds:120}") int leaseSeconds) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.transactions = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
        this.leaseSeconds = Math.max(30, Math.min(900, leaseSeconds));
    }

    @Scheduled(fixedDelayString = "${storage.consultation.cleanup-poll-ms:5000}")
    public void cleanupOne() {
        if (!enabled || !storage.isEnabled()) return;
        CleanupClaim claim = transactions.execute(this::claimOne);
        if (claim == null) return;
        boolean deleted;
        try {
            storage.deleteObjects(List.of(claim.objectKey()));
            deleted = true;
        } catch (RuntimeException exception) {
            // Keep the failure opaque; the retry state is the only observable
            // diagnostic and contains no patient content or object key.
            deleted = false;
        }
        boolean completed = deleted;
        transactions.executeWithoutResult(status -> acknowledge(claim, completed));
    }

    CleanupClaim claimOne(org.springframework.transaction.TransactionStatus ignored) {
        UUID lease = UUID.randomUUID();
        return jdbc.query("""
            WITH candidate AS (
                SELECT id FROM patient_consultation_object_cleanup
                 WHERE ((status IN ('PENDING', 'FAILED') AND attempts < ?
                         AND next_attempt_at <= CURRENT_TIMESTAMP)
                    OR (status = 'PROCESSING' AND attempts <= ?
                        AND lease_expires_at <= CURRENT_TIMESTAMP))
                 ORDER BY next_attempt_at, created_at, id
                 FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE patient_consultation_object_cleanup q
               SET status = 'PROCESSING', lease_token = ?,
                   lease_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                   attempts = CASE WHEN q.status = 'PROCESSING'
                       THEN q.attempts ELSE q.attempts + 1 END
              FROM candidate c WHERE q.id = c.id
            RETURNING q.id, q.object_key, q.lease_token, q.lease_expires_at
            """, (rs, rowNum) -> new CleanupClaim(
                rs.getObject("id", UUID.class),
                rs.getString("object_key"),
                rs.getObject("lease_token", UUID.class),
                rs.getObject("lease_expires_at", OffsetDateTime.class)),
            MAX_ATTEMPTS, MAX_ATTEMPTS, lease, leaseSeconds).stream().findFirst().orElse(null);
    }

    private void acknowledge(CleanupClaim claim, boolean deleted) {
        if (deleted) {
            jdbc.update("""
                UPDATE patient_consultation_object_cleanup
                   SET status = 'DONE', lease_token = NULL, lease_expires_at = NULL,
                       completed_at = CURRENT_TIMESTAMP, last_failure_code = NULL
                 WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?
                   AND lease_expires_at > CURRENT_TIMESTAMP
                """, claim.id(), claim.leaseToken());
            return;
        }
        jdbc.update("""
            UPDATE patient_consultation_object_cleanup
               SET status = CASE WHEN attempts >= ? THEN 'FAILED' ELSE 'PENDING' END,
                   lease_token = NULL, lease_expires_at = NULL,
                   next_attempt_at = CURRENT_TIMESTAMP + (LEAST(attempts, 8) * INTERVAL '30 seconds'),
                   last_failure_code = 'ATTACHMENT_OBJECT_CLEANUP_FAILED'
             WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?
            """, MAX_ATTEMPTS, claim.id(), claim.leaseToken());
    }

    private record CleanupClaim(UUID id, String objectKey, UUID leaseToken, OffsetDateTime leaseExpiresAt) {}
}
