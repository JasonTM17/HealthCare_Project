package com.healthcare.auth.mail;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Test/standalone fallback. It intentionally discards authentication mail. */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoopEmailSender implements EmailSender {

    @Override
    public boolean isDeliveryAvailable() {
        return false;
    }

    @Override
    public void send(String recipient, String subject, String body) {
        // Never log or return OTP content when delivery is disabled.
    }
}
