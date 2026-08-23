package com.healthcare.sync.outbox;

import java.util.Objects;

public record SyncAppendResult(SyncAppendDecision decision, SyncOutboxEvent event) {

    public SyncAppendResult {
        decision = Objects.requireNonNull(decision, "decision");
        event = Objects.requireNonNull(event, "event");
    }
}
