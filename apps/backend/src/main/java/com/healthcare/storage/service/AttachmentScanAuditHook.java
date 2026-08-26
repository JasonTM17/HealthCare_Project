package com.healthcare.storage.service;

import java.time.Instant;
import java.util.UUID;

/**
 * Audit seam for lease, verdict and rejection events.  Implementations should
 * persist only metadata (never attachment bytes or patient message text).
 */
public interface AttachmentScanAuditHook {

    default void onLeaseAcquired(ScanLease lease) {
    }

    default void onScanCompleted(ScanAudit audit) {
    }

    default void onScanRejected(RejectionAudit audit) {
    }

    default void onLeaseReleased(ScanLease lease) {
    }

    record ScanLease(
            UUID leaseId,
            UUID attachmentId,
            String objectKey,
            Instant acquiredAt,
            Instant expiresAt) {
    }

    record ScanAudit(
            UUID attachmentId,
            String objectKey,
            String mimeType,
            long sizeBytes,
            String sha256,
            AttachmentScanner.Verdict verdict,
            Instant completedAt) {
    }

    record RejectionAudit(
            UUID attachmentId,
            String objectKey,
            String reasonCode,
            Instant rejectedAt) {
    }
}
