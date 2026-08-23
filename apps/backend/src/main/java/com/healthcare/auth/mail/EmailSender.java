package com.healthcare.auth.mail;

/** Delivery boundary for security and verification messages; implementations must not log message bodies. */
public interface EmailSender {

    default boolean isDeliveryAvailable() {
        return true;
    }

    void send(String recipient, String subject, String body);
}
