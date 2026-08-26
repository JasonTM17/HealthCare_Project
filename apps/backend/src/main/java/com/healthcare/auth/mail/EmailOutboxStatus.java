package com.healthcare.auth.mail;

public enum EmailOutboxStatus {
    QUEUED,
    PROCESSING,
    RETRY,
    SENT,
    EXPIRED,
    DEAD
}
