package com.healthcare.auth.mail;

/** Closed operational result for an optional notification disabled by the user. */
public class EmailDeliverySuppressedException extends RuntimeException {
    public EmailDeliverySuppressedException() {
        super("Optional email delivery is disabled by the recipient preference");
    }
}
