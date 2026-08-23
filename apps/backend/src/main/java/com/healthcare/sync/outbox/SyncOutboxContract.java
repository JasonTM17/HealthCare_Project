package com.healthcare.sync.outbox;

import java.time.Duration;
import java.util.Objects;

/** Pure decision rules shared by a future durable outbox adapter and its tests. */
public final class SyncOutboxContract {

    private SyncOutboxContract() {
    }

    /**
     * Reconciles an incoming event against the latest event for the same entity
     * or an exact event-id lookup. The persistence adapter must perform this
     * decision while holding its entity/revision uniqueness boundary.
     */
    public static SyncAppendDecision reconcile(SyncOutboxEvent existing, SyncOutboxEvent incoming) {
        Objects.requireNonNull(incoming, "incoming");
        if (existing == null) {
            return SyncAppendDecision.ACCEPTED;
        }
        if (existing.eventId().equals(incoming.eventId())) {
            return existing.hasSameIdentityAndContent(incoming)
                ? SyncAppendDecision.IDEMPOTENT_REPLAY
                : SyncAppendDecision.CONFLICT;
        }
        if (!existing.identity().targetsSameEntity(incoming.identity())) {
            throw new IllegalArgumentException("existing event must target the same entity");
        }
        if (incoming.identity().revision() < existing.identity().revision()) {
            return SyncAppendDecision.STALE_REVISION;
        }
        if (incoming.identity().revision() == existing.identity().revision()) {
            return existing.identity().equals(incoming.identity())
                && existing.contentHash().equals(incoming.contentHash())
                ? SyncAppendDecision.IDEMPOTENT_REPLAY
                : SyncAppendDecision.CONFLICT;
        }
        return SyncAppendDecision.ACCEPTED;
    }

    public static void validateBatchLimit(int limit) {
        if (limit < 1 || limit > 1_000) {
            throw new IllegalArgumentException("batch limit must be between 1 and 1000");
        }
    }

    public static void validateLease(Duration lease) {
        if (lease == null || lease.isZero() || lease.isNegative() || lease.compareTo(Duration.ofHours(1)) > 0) {
            throw new IllegalArgumentException("lease must be positive and no longer than one hour");
        }
    }
}
