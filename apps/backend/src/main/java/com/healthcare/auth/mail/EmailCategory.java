package com.healthcare.auth.mail;

/** Closed category bucket for notification preference and policy decisions. */
public enum EmailCategory {
    SECURITY_CRITICAL(false),
    CARE_TRANSACTIONAL(false),
    OPTIONAL_REMINDER(true);

    private final boolean suppressible;

    EmailCategory(boolean suppressible) {
        this.suppressible = suppressible;
    }

    public boolean suppressible() {
        return suppressible;
    }
}
