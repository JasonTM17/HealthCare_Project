package com.healthcare.document.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DB-authoritative cleanup queue for generated document objects. A generated
 * object is tracked in a separate transaction immediately after upload; normal
 * finalization resolves the marker after commit, while rolled-back finalization
 * leaves a due row that this worker can safely delete later. The worker never
 * deletes an object key that is still referenced by patient_documents.
 */
@Component
public class DocumentObjectCleanupService {

    static final int MAX_ATTEMPTS = 20;
    static final int INITIAL_GRACE_SECONDS = 300;

    private final JdbcTemplate jdbc;
    private final DocumentObjectStore objectStore;
    private final TransactionTemplate transactions;
    private final boolean enabled;
    private final int leaseSeconds;

    public DocumentObjectCleanupService(
            JdbcTemplate jdbc,
            DocumentObjectStore objectStore,
            PlatformTransactionManager transactionManager,
            @Value("${storage.document.cleanup-worker-enabled:true}") boolean enabled,
            @Value("${storage.document.cleanup-lease-seconds:120}") int leaseSeconds) {
        this.jdbc = jdbc;
        this.objectStore = objectStore;
        this.transactions = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
        this.leaseSeconds = Math.max(30, Math.min(900, leaseSeconds));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackCandidate(String objectKey) {
        jdbc.update("""
            INSERT INTO patient_document_object_cleanup(object_key, status, attempts, next_attempt_at,
                lease_token, lease_expires_at, last_failure_code, completed_at)
            VALUES (?, 'PENDING', 0, CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                NULL, NULL, NULL, NULL)
            ON CONFLICT (object_key) DO UPDATE
               SET status = 'PENDING',
                   attempts = 0,
                   next_attempt_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                   lease_token = NULL,
                   lease_expires_at = NULL,
                   last_failure_code = NULL,
                   completed_at = NULL
            """, objectKey, INITIAL_GRACE_SECONDS, INITIAL_GRACE_SECONDS);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void resolveCandidate(String objectKey) {
        jdbc.update("""
            UPDATE patient_document_object_cleanup
               SET status = 'DONE', lease_token = NULL, lease_expires_at = NULL,
                   completed_at = CURRENT_TIMESTAMP, last_failure_code = NULL
             WHERE object_key = ? AND status <> 'DONE'
            """, objectKey);
    }

    @Scheduled(fixedDelayString = "${storage.document.cleanup-poll-ms:5000}")
    public void cleanupOne() {
        if (!enabled || !objectStore.isConfigured()) {
            return;
        }
        CleanupClaim claim = transactions.execute(this::claimOne);
        if (claim == null) {
            return;
        }
        boolean deleted;
        try {
            objectStore.delete(claim.objectKey());
            deleted = true;
        } catch (Exception exception) {
            // Do not log object keys or patient details. Retry state is enough.
            deleted = false;
        }
        boolean completed = deleted;
        transactions.executeWithoutResult(status -> acknowledge(claim, completed));
    }

    CleanupClaim claimOne(org.springframework.transaction.TransactionStatus ignored) {
        reconcileCommittedDocuments();
        jdbc.update("""
            UPDATE patient_document_object_cleanup
               SET status = 'FAILED', lease_token = NULL, lease_expires_at = NULL,
                   completed_at = NULL,
                   next_attempt_at = CURRENT_TIMESTAMP,
                   last_failure_code = 'DOCUMENT_OBJECT_CLEANUP_LEASE_EXPIRED'
             WHERE status = 'PROCESSING' AND attempts >= ?
               AND lease_expires_at <= CURRENT_TIMESTAMP
            """, MAX_ATTEMPTS);
        UUID lease = UUID.randomUUID();
        return jdbc.query("""
            WITH candidate AS (
                SELECT q.id FROM patient_document_object_cleanup q
                 WHERE ((q.status IN ('PENDING', 'FAILED') AND q.attempts < ?
                         AND q.next_attempt_at <= CURRENT_TIMESTAMP)
                    OR (q.status = 'PROCESSING' AND q.attempts < ?
                        AND q.lease_expires_at <= CURRENT_TIMESTAMP))
                   AND NOT EXISTS (
                        SELECT 1 FROM patient_documents d
                         WHERE d.object_key = q.object_key
                   )
                 ORDER BY q.next_attempt_at, q.created_at, q.id
                 FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE patient_document_object_cleanup q
               SET status = 'PROCESSING',
                   lease_token = ?,
                   lease_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                   attempts = q.attempts + 1
              FROM candidate c WHERE q.id = c.id
            RETURNING q.id, q.object_key, q.lease_token, q.lease_expires_at
            """, (rs, rowNum) -> new CleanupClaim(
                rs.getObject("id", UUID.class),
                rs.getString("object_key"),
                rs.getObject("lease_token", UUID.class),
                rs.getObject("lease_expires_at", OffsetDateTime.class)),
            MAX_ATTEMPTS, MAX_ATTEMPTS, lease, leaseSeconds).stream().findFirst().orElse(null);
    }

    private void reconcileCommittedDocuments() {
        jdbc.update("""
            UPDATE patient_document_object_cleanup q
               SET status = 'DONE', lease_token = NULL, lease_expires_at = NULL,
                   completed_at = COALESCE(q.completed_at, CURRENT_TIMESTAMP),
                   last_failure_code = NULL
             WHERE q.status <> 'DONE'
               AND EXISTS (
                    SELECT 1 FROM patient_documents d
                     WHERE d.object_key = q.object_key
               )
            """);
    }

    private void acknowledge(CleanupClaim claim, boolean deleted) {
        if (deleted) {
            jdbc.update("""
                UPDATE patient_document_object_cleanup
                   SET status = 'DONE', lease_token = NULL, lease_expires_at = NULL,
                       completed_at = CURRENT_TIMESTAMP, last_failure_code = NULL
                 WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?
                   AND lease_expires_at > CURRENT_TIMESTAMP
                """, claim.id(), claim.leaseToken());
            return;
        }
        jdbc.update("""
            UPDATE patient_document_object_cleanup
               SET status = CASE WHEN attempts >= ? THEN 'FAILED' ELSE 'PENDING' END,
                   lease_token = NULL, lease_expires_at = NULL,
                   next_attempt_at = CURRENT_TIMESTAMP + (LEAST(attempts, 8) * INTERVAL '30 seconds'),
                   last_failure_code = 'DOCUMENT_OBJECT_CLEANUP_FAILED'
             WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?
            """, MAX_ATTEMPTS, claim.id(), claim.leaseToken());
    }

    record CleanupClaim(UUID id, String objectKey, UUID leaseToken, OffsetDateTime leaseExpiresAt) {}
}
