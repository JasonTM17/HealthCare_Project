package com.healthcare.sync.outbox;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable server-owned outbox state. It carries metadata only; consumers
 * resolve public or de-identified content from an authorized server-side
 * projection using the entity reference.
 */
public record SyncOutboxEvent(
    UUID eventId,
    long cursor,
    SyncEventIdentity identity,
    SyncContentHash contentHash,
    OffsetDateTime occurredAt,
    UUID correlationId,
    SyncOutboxStatus status,
    int attemptCount,
    UUID leaseToken,
    OffsetDateTime leaseExpiresAt,
    OffsetDateTime availableAt
) {

    public SyncOutboxEvent {
        eventId = Objects.requireNonNull(eventId, "eventId");
        identity = Objects.requireNonNull(identity, "identity");
        contentHash = Objects.requireNonNull(contentHash, "contentHash");
        occurredAt = utc(occurredAt, "occurredAt");
        correlationId = Objects.requireNonNull(correlationId, "correlationId");
        status = Objects.requireNonNull(status, "status");
        availableAt = utc(availableAt, "availableAt");
        if (cursor < 0) {
            throw new IllegalArgumentException("cursor cannot be negative");
        }
        if (attemptCount < 0) {
            throw new IllegalArgumentException("attemptCount cannot be negative");
        }
        if (status == SyncOutboxStatus.PROCESSING) {
            if (leaseToken == null || leaseExpiresAt == null) {
                throw new IllegalArgumentException("processing event requires an active lease");
            }
            leaseExpiresAt = utc(leaseExpiresAt, "leaseExpiresAt");
            if (!leaseExpiresAt.isAfter(occurredAt)) {
                throw new IllegalArgumentException("lease must expire after event occurrence");
            }
        } else if (leaseToken != null || leaseExpiresAt != null) {
            throw new IllegalArgumentException("only processing events may carry a lease");
        }
    }

    public static SyncOutboxEvent pending(
        SyncEventIdentity identity,
        SyncContentHash contentHash,
        OffsetDateTime occurredAt,
        UUID correlationId
    ) {
        OffsetDateTime eventTime = utc(occurredAt, "occurredAt");
        return new SyncOutboxEvent(
            UUID.randomUUID(),
            0,
            identity,
            contentHash,
            eventTime,
            correlationId,
            SyncOutboxStatus.PENDING,
            0,
            null,
            null,
            eventTime
        );
    }

    public SyncOutboxEvent withCursor(long assignedCursor) {
        if (assignedCursor <= 0) {
            throw new IllegalArgumentException("persisted cursor must be positive");
        }
        if (cursor != 0 && cursor != assignedCursor) {
            throw new IllegalStateException("cursor cannot be reassigned");
        }
        return copy(assignedCursor, status, attemptCount, leaseToken, leaseExpiresAt, availableAt);
    }

    public boolean claimableAt(OffsetDateTime at) {
        OffsetDateTime now = utc(at, "at");
        return switch (status) {
            case PENDING, RETRYABLE -> !now.isBefore(availableAt);
            case PROCESSING -> leaseExpiresAt != null && !now.isBefore(leaseExpiresAt);
            case PROCESSED, DEAD_LETTER -> false;
        };
    }

    public SyncOutboxEvent claim(UUID workerLeaseToken, OffsetDateTime at, Duration lease) {
        UUID token = Objects.requireNonNull(workerLeaseToken, "workerLeaseToken");
        OffsetDateTime now = utc(at, "at");
        if (!claimableAt(now)) {
            throw new IllegalStateException("event is not claimable");
        }
        SyncOutboxContract.validateLease(lease);
        if (attemptCount == Integer.MAX_VALUE) {
            throw new IllegalStateException("attempt counter is exhausted");
        }
        return copy(
            cursor,
            SyncOutboxStatus.PROCESSING,
            attemptCount + 1,
            token,
            now.plus(lease),
            availableAt
        );
    }

    public SyncOutboxEvent acknowledge(UUID workerLeaseToken, OffsetDateTime at) {
        OffsetDateTime now = requireActiveLease(workerLeaseToken, at);
        return copy(cursor, SyncOutboxStatus.PROCESSED, attemptCount, null, null, now);
    }

    public SyncOutboxEvent retryOrDeadLetter(
        UUID workerLeaseToken,
        OffsetDateTime at,
        OffsetDateTime retryAt,
        int maxAttempts
    ) {
        OffsetDateTime now = requireActiveLease(workerLeaseToken, at);
        if (maxAttempts < 1 || maxAttempts > 1_000) {
            throw new IllegalArgumentException("maxAttempts must be between 1 and 1000");
        }
        OffsetDateTime nextAttemptAt = utc(retryAt, "retryAt");
        if (nextAttemptAt.isBefore(now)) {
            throw new IllegalArgumentException("retryAt cannot be before now");
        }
        SyncOutboxStatus nextStatus = attemptCount >= maxAttempts
            ? SyncOutboxStatus.DEAD_LETTER
            : SyncOutboxStatus.RETRYABLE;
        return copy(
            cursor,
            nextStatus,
            attemptCount,
            null,
            null,
            nextStatus == SyncOutboxStatus.DEAD_LETTER ? now : nextAttemptAt
        );
    }

    public boolean hasSameIdentityAndContent(SyncOutboxEvent other) {
        return other != null
            && eventId.equals(other.eventId)
            && identity.equals(other.identity)
            && contentHash.equals(other.contentHash);
    }

    private OffsetDateTime requireActiveLease(UUID workerLeaseToken, OffsetDateTime at) {
        UUID token = Objects.requireNonNull(workerLeaseToken, "workerLeaseToken");
        OffsetDateTime now = utc(at, "at");
        if (status != SyncOutboxStatus.PROCESSING
            || !token.equals(leaseToken)
            || leaseExpiresAt == null
            || now.isAfter(leaseExpiresAt)) {
            throw new IllegalStateException("worker does not own an active event lease");
        }
        return now;
    }

    private SyncOutboxEvent copy(
        long nextCursor,
        SyncOutboxStatus nextStatus,
        int nextAttemptCount,
        UUID nextLeaseToken,
        OffsetDateTime nextLeaseExpiresAt,
        OffsetDateTime nextAvailableAt
    ) {
        return new SyncOutboxEvent(
            eventId,
            nextCursor,
            identity,
            contentHash,
            occurredAt,
            correlationId,
            nextStatus,
            nextAttemptCount,
            nextLeaseToken,
            nextLeaseExpiresAt,
            nextAvailableAt
        );
    }

    private static OffsetDateTime utc(OffsetDateTime value, String field) {
        return Objects.requireNonNull(value, field).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
