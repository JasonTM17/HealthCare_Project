package com.healthcare.sync.outbox;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Internal server port for the future durable outbox implementation.
 *
 * <p>This is intentionally not a controller contract. Implementations must
 * append in the same transaction as the authoritative Spring mutation, claim
 * in cursor order, and require the worker lease token for acknowledgements.
 * The event contains no client payload or user identity.</p>
 */
public interface SyncOutboxPort {

    SyncAppendResult append(SyncOutboxEvent event);

    SyncBatch claimBatch(
        SyncCursor after,
        int limit,
        UUID workerId,
        Duration lease,
        OffsetDateTime now
    );

    void acknowledge(UUID eventId, UUID claimToken, OffsetDateTime acknowledgedAt);

    void retryOrDeadLetter(
        UUID eventId,
        UUID claimToken,
        OffsetDateTime now,
        OffsetDateTime retryAt,
        int maxAttempts
    );
}
