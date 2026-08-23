package com.healthcare.sync.outbox;

public enum SyncOutboxStatus {
    PENDING,
    PROCESSING,
    PROCESSED,
    RETRYABLE,
    DEAD_LETTER
}
