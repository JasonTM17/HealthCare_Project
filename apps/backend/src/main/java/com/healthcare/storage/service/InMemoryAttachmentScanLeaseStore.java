package com.healthcare.storage.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Process-local lease implementation for the bounded beta slice.  A hosted
 * deployment should replace this bean with a durable SQL/Redis lease store;
 * scan status remains owned by the consultation database in either case.
 */
public class InMemoryAttachmentScanLeaseStore implements AttachmentScanLeaseStore {

    private final Clock clock;
    private final Map<String, AttachmentScanAuditHook.ScanLease> leases = new ConcurrentHashMap<>();

    public InMemoryAttachmentScanLeaseStore() {
        this(Clock.systemUTC());
    }

    public InMemoryAttachmentScanLeaseStore(Clock clock) {
        this.clock = clock == null ? Clock.systemUTC() : clock;
    }

    @Override
    public Optional<AttachmentScanAuditHook.ScanLease> tryAcquire(
            UUID attachmentId, String objectKey, Duration leaseDuration) {
        return acquire(attachmentId, objectKey, leaseDuration);
    }

    /** Acquires and returns the candidate when no unexpired owner exists. */
    public Optional<AttachmentScanAuditHook.ScanLease> acquire(
            UUID attachmentId, String objectKey, Duration leaseDuration) {
        if (attachmentId == null || objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        Instant now = Instant.now(clock);
        AttachmentScanAuditHook.ScanLease candidate = new AttachmentScanAuditHook.ScanLease(
                UUID.randomUUID(),
                attachmentId,
                objectKey,
                now,
                now.plus(normalizeDuration(leaseDuration)));
        while (true) {
            AttachmentScanAuditHook.ScanLease current = leases.get(objectKey);
            if (current != null && current.expiresAt().isAfter(now)) {
                return Optional.empty();
            }
            if (current == null) {
                if (leases.putIfAbsent(objectKey, candidate) == null) {
                    return Optional.of(candidate);
                }
            } else if (leases.replace(objectKey, current, candidate)) {
                return Optional.of(candidate);
            }
        }
    }

    @Override
    public void release(AttachmentScanAuditHook.ScanLease lease) {
        if (lease != null) {
            leases.remove(lease.objectKey(), lease);
        }
    }

    private Duration normalizeDuration(Duration requested) {
        if (requested == null || requested.isZero() || requested.isNegative()) {
            return Duration.ofMinutes(2);
        }
        return requested.compareTo(Duration.ofMinutes(15)) > 0
                ? Duration.ofMinutes(15)
                : requested;
    }

    /** Visible for deterministic tests and operational diagnostics. */
    int activeLeaseCount() {
        return leases.size();
    }
}
