package com.healthcare.sync.outbox;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** A leased, cursor-ordered batch returned by an internal sync worker port. */
public record SyncBatch(
    UUID claimToken,
    UUID workerId,
    SyncBatchStatus status,
    SyncCursor requestedAfter,
    SyncCursor nextCursor,
    List<SyncOutboxEvent> events,
    boolean hasMore,
    OffsetDateTime leaseExpiresAt
) {

    public SyncBatch {
        claimToken = Objects.requireNonNull(claimToken, "claimToken");
        workerId = Objects.requireNonNull(workerId, "workerId");
        status = Objects.requireNonNull(status, "status");
        requestedAfter = Objects.requireNonNull(requestedAfter, "requestedAfter");
        nextCursor = Objects.requireNonNull(nextCursor, "nextCursor");
        events = List.copyOf(Objects.requireNonNull(events, "events"));
        leaseExpiresAt = Objects.requireNonNull(leaseExpiresAt, "leaseExpiresAt")
            .withOffsetSameInstant(ZoneOffset.UTC);

        if (events.isEmpty()) {
            if (status != SyncBatchStatus.EMPTY || hasMore || !nextCursor.equals(requestedAfter)) {
                throw new IllegalArgumentException("empty batch must have EMPTY status and no cursor advance");
            }
        } else {
            if (status != SyncBatchStatus.CLAIMED || nextCursor.value() <= requestedAfter.value()) {
                throw new IllegalArgumentException("non-empty batch must be claimed and advance the cursor");
            }

            long previousCursor = requestedAfter.value();
            for (SyncOutboxEvent event : events) {
                if (event.cursor() <= previousCursor) {
                    throw new IllegalArgumentException("batch events must be strictly cursor ordered");
                }
                if (event.status() != SyncOutboxStatus.PROCESSING
                    || !claimToken.equals(event.leaseToken())
                    || event.leaseExpiresAt() == null
                    || !event.leaseExpiresAt().isEqual(leaseExpiresAt)) {
                    throw new IllegalArgumentException("batch event is not owned by the batch lease");
                }
                previousCursor = event.cursor();
            }
            if (previousCursor != nextCursor.value()) {
                throw new IllegalArgumentException("nextCursor must equal the last event cursor");
            }
        }
    }

    public static SyncBatch empty(
        UUID claimToken,
        UUID workerId,
        SyncCursor requestedAfter,
        OffsetDateTime leaseExpiresAt
    ) {
        return new SyncBatch(
            claimToken,
            workerId,
            SyncBatchStatus.EMPTY,
            requestedAfter,
            requestedAfter,
            List.of(),
            false,
            leaseExpiresAt
        );
    }
}
