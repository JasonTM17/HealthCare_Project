package com.healthcare.consultation.service;

import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/** Database leases fence work; no transaction or row lock spans S3/AV calls. */
@Component
public class ConsultationAttachmentScanWorker {
    private static final int MAX_ATTEMPTS = 8;
    private static final Set<String> REJECTIONS = Set.of("ATTACHMENT_SIZE_MISMATCH",
        "ATTACHMENT_MIME_MISMATCH", "ATTACHMENT_MIME_METADATA_MISMATCH", "ATTACHMENT_HASH_MISMATCH",
        "ATTACHMENT_REJECTED_BY_SCANNER", "ATTACHMENT_OBJECT_KEY_FORGED", "ATTACHMENT_OBJECT_KEY_PURPOSE_INVALID");
    private final JdbcTemplate jdbc;
    private final ConsultationAttachmentStorage storage;
    private final TransactionTemplate transactions;
    private final boolean enabled;
    private final int leaseSeconds;

    public ConsultationAttachmentScanWorker(JdbcTemplate jdbc, ConsultationAttachmentStorage storage,
            PlatformTransactionManager transactionManager,
            @Value("${storage.consultation.worker-enabled:false}") boolean enabled,
            @Value("${storage.consultation.scan-lease-seconds:120}") int leaseSeconds) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.transactions = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
        this.leaseSeconds = Math.max(30, Math.min(900, leaseSeconds));
    }

    @Scheduled(fixedDelayString = "${storage.consultation.scan-poll-ms:2000}")
    public void scanOne() {
        if (!enabled) return;
        transactions.executeWithoutResult(status -> expireAbandoned());
        if (!storage.isEnabled()) return;
        Claim claim = transactions.execute(status -> claimOne());
        if (claim == null) return;
        ConsultationAttachmentStorage.CompletionResult result;
        try {
            result = storage.scanWithLease(claim.request(), claim.lease());
        } catch (RuntimeException exception) {
            // Never log bytes, names, object keys or raw scanner/provider errors.
            result = null;
        }
        var observed = result;
        transactions.executeWithoutResult(status -> finish(claim, observed));
    }

    private Claim claimOne() {
        UUID lease = UUID.randomUUID();
        return jdbc.query("""
            WITH candidate AS (
                SELECT a.id FROM patient_consultation_attachments a
                  JOIN patient_consultation_threads t ON t.id = a.thread_id
                 WHERE a.scan_status = 'PENDING' AND a.upload_status = 'UPLOADED'
                   AND a.scan_available_at <= CURRENT_TIMESTAMP
                   AND a.scan_attempts < ?
                   AND a.retention_expires_at > CURRENT_TIMESTAMP
                   AND t.retention_expires_at > CURRENT_TIMESTAMP
                   AND (a.scan_lease_token IS NULL OR a.scan_lease_expires_at <= CURRENT_TIMESTAMP)
                 ORDER BY a.scan_available_at, a.created_at, a.id
                 FOR UPDATE OF a SKIP LOCKED LIMIT 1
            )
            UPDATE patient_consultation_attachments a
               SET scan_lease_token = ?, scan_lease_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                   scan_attempts = scan_attempts + 1
              FROM candidate c WHERE a.id = c.id
            RETURNING a.*, CURRENT_TIMESTAMP AS database_now
            """, (rs, n) -> {
                UUID id = rs.getObject("id", UUID.class);
                UUID thread = rs.getObject("thread_id", UUID.class);
                String key = rs.getString("private_object_key");
                return new Claim(new ConsultationAttachmentStorage.CompletionRequest(thread, id, key,
                    rs.getString("declared_mime_type"), rs.getLong("size_bytes"), rs.getString("sha256_hash")),
                    new AttachmentScanAuditHook.ScanLease(lease, id, key,
                        rs.getObject("database_now", OffsetDateTime.class).toInstant(),
                        rs.getObject("scan_lease_expires_at", OffsetDateTime.class).toInstant()),
                    rs.getInt("scan_attempts"));
            }, MAX_ATTEMPTS, lease, leaseSeconds).stream().findFirst().map(claim -> {
                audit(claim, "SCANNING");
                return claim;
            }).orElse(null);
    }

    void finish(Claim claim, ConsultationAttachmentStorage.CompletionResult result) {
        var request = claim.request();
        boolean clean = result != null && result.availability() == ConsultationAttachmentStorage.Availability.ENABLED
            && result.scanStatus() == ConsultationAttachmentStorage.ScanStatus.CLEAN
            && request.attachmentId().equals(result.attachmentId())
            && result.privateObjectKey() != null && !request.privateObjectKey().equals(result.privateObjectKey())
            && request.expectedMimeType().equals(result.actualMimeType())
            && request.expectedSizeBytes() == result.actualSizeBytes()
            && request.expectedSha256().equals(result.actualSha256());
        boolean rejected = result != null && result.scanStatus() == ConsultationAttachmentStorage.ScanStatus.REJECTED
            && result.failureCode() != null && REJECTIONS.contains(result.failureCode());
        boolean exhausted = !clean && !rejected && claim.attempts() >= MAX_ATTEMPTS;
        String scanStatus = clean ? "CLEAN" : rejected || exhausted ? "REJECTED" : "PENDING";
        String code = clean ? null : rejected ? result.failureCode()
            : exhausted ? "ATTACHMENT_SCAN_RETRY_EXHAUSTED" : "ATTACHMENT_SCAN_RETRY_PENDING";
        if (clean || rejected || exhausted) {
            // Queue both the quarantine upload and the verified promotion
            // before the lease-fenced row update. If the lease expires or the
            // thread is deleted while storage work is in flight, the queue is
            // still the DB authority for discovering every private object.
            queueObjectCleanup(claim.request().threadId(), claim.request().attachmentId(),
                claim.request().privateObjectKey());
            if (clean) {
                queueObjectCleanup(claim.request().threadId(), claim.request().attachmentId(),
                    result.privateObjectKey());
            }
        }
        int changed = jdbc.update("""
            UPDATE patient_consultation_attachments AS a
               SET private_object_key = ?, actual_mime_type = ?, scan_status = ?,
                   upload_status = ?, rejection_code = ?,
                   scanned_at = CASE WHEN ? = 'PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END,
                   scan_available_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                   scan_lease_token = NULL, scan_lease_expires_at = NULL
             WHERE id = ? AND thread_id = ? AND private_object_key = ?
               AND scan_status = 'PENDING' AND upload_status = 'UPLOADED'
               AND scan_lease_token = ? AND scan_lease_expires_at > CURRENT_TIMESTAMP
               AND retention_expires_at > CURRENT_TIMESTAMP
               AND EXISTS (SELECT 1 FROM patient_consultation_threads t
                            WHERE t.id = a.thread_id AND t.retention_expires_at > CURRENT_TIMESTAMP)
            """, clean ? result.privateObjectKey() : request.privateObjectKey(),
            clean ? result.actualMimeType() : null, scanStatus,
            "REJECTED".equals(scanStatus) ? "REJECTED" : "UPLOADED", code, scanStatus,
            Math.min(300, 1 << Math.min(8, claim.attempts())), request.attachmentId(), request.threadId(),
            request.privateObjectKey(), claim.lease().leaseId());
        if (changed == 1) audit(claim, scanStatus);
        // The cleanup queue is drained independently, so a stale/expired
        // worker cannot leave a verified object permanently undiscoverable.
    }

    private void queueObjectCleanup(UUID threadId, UUID attachmentId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) return;
        jdbc.update("""
            INSERT INTO patient_consultation_object_cleanup
                (thread_id, attachment_id, object_key)
            VALUES (?, ?, ?)
            ON CONFLICT (object_key) DO NOTHING
            """, threadId, attachmentId, objectKey);
    }

    private void audit(Claim claim, String state) {
        jdbc.update("""
            INSERT INTO patient_consultation_events(thread_id, actor_role_snapshot, event_type, metadata)
            VALUES (?, 'SYSTEM', 'SCAN_RESULT', jsonb_build_object('attachmentId', CAST(? AS text), 'status', CAST(? AS text)))
            """, claim.request().threadId(), claim.request().attachmentId(), state);
    }

    private void expireAbandoned() {
        jdbc.update("""
            WITH due AS (
                SELECT id FROM patient_consultation_attachments
                 WHERE scan_status = 'PENDING'
                   AND ((upload_status IN ('REQUESTED', 'UPLOADING') AND upload_expires_at <= CURRENT_TIMESTAMP)
                     OR (upload_status = 'UPLOADED' AND scan_attempts >= ?
                         AND (scan_lease_token IS NULL OR scan_lease_expires_at <= CURRENT_TIMESTAMP)))
                 ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 20
            ), expired AS (
                UPDATE patient_consultation_attachments a
                   SET scan_status = 'REJECTED',
                       rejection_code = CASE WHEN a.upload_status = 'UPLOADED'
                           THEN 'ATTACHMENT_SCAN_RETRY_EXHAUSTED' ELSE 'ATTACHMENT_UPLOAD_EXPIRED' END,
                       upload_status = CASE WHEN a.upload_status = 'UPLOADED' THEN 'REJECTED' ELSE 'EXPIRED' END,
                       scanned_at = CURRENT_TIMESTAMP, scan_lease_token = NULL, scan_lease_expires_at = NULL
                  FROM due WHERE a.id = due.id RETURNING a.thread_id, a.id
            )
            INSERT INTO patient_consultation_events(thread_id, actor_role_snapshot, event_type, metadata)
            SELECT thread_id, 'SYSTEM', 'SCAN_RESULT', jsonb_build_object('attachmentId', id, 'status', 'REJECTED')
              FROM expired
            """, MAX_ATTEMPTS);
    }

    record Claim(ConsultationAttachmentStorage.CompletionRequest request,
                 AttachmentScanAuditHook.ScanLease lease, int attempts) {}
}
