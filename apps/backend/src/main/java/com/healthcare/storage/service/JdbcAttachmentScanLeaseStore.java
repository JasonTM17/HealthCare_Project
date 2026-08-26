package com.healthcare.storage.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Database-owned scan lease for multi-instance deployments.
 *
 * <p>The attachment row is the authority for the lease.  Acquisition is one
 * atomic PostgreSQL UPDATE, so two Render instances cannot scan the same
 * object concurrently.  A lease that expires is eligible for a later retry;
 * releasing a lease is conditional on the opaque lease token and therefore
 * cannot clear a newer worker's ownership.</p>
 */
@Component
public final class JdbcAttachmentScanLeaseStore implements AttachmentScanLeaseStore {

    private final JdbcTemplate jdbc;
    private final PlatformTransactionManager transactionManager;

    @Autowired
    public JdbcAttachmentScanLeaseStore(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.transactionManager = transactionManager;
    }

    /** Source-compatible seam for unit tests that do not create a transaction manager. */
    public JdbcAttachmentScanLeaseStore(JdbcTemplate jdbc) {
        this(jdbc, null);
    }

    @Override
    public Optional<AttachmentScanAuditHook.ScanLease> tryAcquire(
            UUID attachmentId, String objectKey, Duration leaseDuration) {
        if (attachmentId == null || objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        Duration bounded = normalize(leaseDuration);
        UUID leaseToken = UUID.randomUUID();
        try {
            return inLeaseTransaction(() -> jdbc.query("""
                UPDATE patient_consultation_attachments
                   SET scan_lease_token = ?,
                       scan_lease_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                       scan_attempts = scan_attempts + 1,
                       upload_status = 'UPLOADING'
                 WHERE id = ?
                   AND private_object_key = ?
                   AND scan_status = 'PENDING'
                   AND upload_status IN ('REQUESTED', 'UPLOADING', 'UPLOADED')
                   AND retention_expires_at > CURRENT_TIMESTAMP
                   AND (scan_lease_token IS NULL OR scan_lease_expires_at <= CURRENT_TIMESTAMP)
                RETURNING scan_lease_token, scan_lease_expires_at,
                          CURRENT_TIMESTAMP AS database_now
                """, (rs, rowNum) -> {
                    UUID persistedToken = rs.getObject("scan_lease_token", UUID.class);
                    OffsetDateTime expires = rs.getObject("scan_lease_expires_at", OffsetDateTime.class);
                    OffsetDateTime acquired = rs.getObject("database_now", OffsetDateTime.class);
                    if (persistedToken == null || expires == null || acquired == null) {
                        return null;
                    }
                    return new AttachmentScanAuditHook.ScanLease(
                        persistedToken, attachmentId, objectKey,
                        acquired.toInstant(), expires.toInstant());
                }, leaseToken, bounded.getSeconds(), attachmentId, objectKey)
                .stream()
                .filter(java.util.Objects::nonNull)
                .findFirst());
        } catch (RuntimeException ex) {
            // A database/connection outage must keep the object quarantined;
            // callers see an empty lease and never infer CLEAN.
            return Optional.empty();
        }
    }

    @Override
    public void release(AttachmentScanAuditHook.ScanLease lease) {
        if (lease == null || lease.leaseId() == null || lease.attachmentId() == null) {
            return;
        }
        // Consultation completion runs inside the domain transaction and
        // updates the same attachment row after scanning.  Clearing the lease
        // in a REQUIRES_NEW transaction before that outer transaction commits
        // would deadlock on PostgreSQL's row lock.  Defer the conditional
        // release until commit/rollback; an interrupted process still recovers
        // through scan_lease_expires_at.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    clearLease(lease);
                }
            });
            return;
        }
        clearLease(lease);
    }

    private void clearLease(AttachmentScanAuditHook.ScanLease lease) {
        try {
            inLeaseTransaction(() -> {
                jdbc.update("""
                UPDATE patient_consultation_attachments
                   SET scan_lease_token = NULL, scan_lease_expires_at = NULL
                 WHERE id = ? AND private_object_key = ? AND scan_lease_token = ?
                """, lease.attachmentId(), lease.objectKey(), lease.leaseId());
                return null;
            });
        } catch (RuntimeException ignored) {
            // Lease expiry remains the recovery path if release races a
            // transient database outage.  Never broaden the update predicate.
        }
    }

    private Duration normalize(Duration requested) {
        if (requested == null || requested.isZero() || requested.isNegative()) {
            return Duration.ofMinutes(2);
        }
        return requested.compareTo(Duration.ofMinutes(15)) > 0
            ? Duration.ofMinutes(15) : requested;
    }

    private <T> T inLeaseTransaction(java.util.function.Supplier<T> action) {
        if (transactionManager == null) {
            return action.get();
        }
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(
            org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template.execute(status -> action.get());
    }
}
