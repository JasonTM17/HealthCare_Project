package com.healthcare.storage.service;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/** Coordinates one trusted scan at a time for an object key. */
public interface AttachmentScanLeaseStore {

    Optional<AttachmentScanAuditHook.ScanLease> tryAcquire(
            UUID attachmentId, String objectKey, Duration leaseDuration);

    void release(AttachmentScanAuditHook.ScanLease lease);
}
