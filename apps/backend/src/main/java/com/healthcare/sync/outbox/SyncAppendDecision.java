package com.healthcare.sync.outbox;

public enum SyncAppendDecision {
    ACCEPTED,
    IDEMPOTENT_REPLAY,
    STALE_REVISION,
    CONFLICT
}
