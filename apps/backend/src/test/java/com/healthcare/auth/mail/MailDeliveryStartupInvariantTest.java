package com.healthcare.auth.mail;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MailDeliveryStartupInvariantTest {

    @Test
    void mailDisabledSkipsEveryRequirement() {
        assertThatCode(() -> invariant(false, true, "", "", "localhost").validate())
            .doesNotThrowAnyException();
    }

    @Test
    void outboxEnabledWithoutKeyFailsStartup() {
        assertThatThrownBy(() -> invariant(true, true, "", "resend-key", "localhost").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("APP_MAIL_OUTBOX_ENCRYPTION_KEY");
    }

    @Test
    void outboxEnabledWithMalformedOrWrongLengthKeyFailsStartup() {
        assertThatThrownBy(() -> invariant(true, true, "not-base64!!!", "resend-key", "localhost").validate())
            .isInstanceOf(IllegalStateException.class);
        // 8 bytes is valid Base64 but not an AES key length the cipher accepts.
        String shortKey = Base64.getEncoder().encodeToString(new byte[8]);
        assertThatThrownBy(() -> invariant(true, true, shortKey, "resend-key", "localhost").validate())
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void outboxEnabledWithValidAesKeyLengthsStarts() {
        for (int length : new int[] {16, 24, 32}) {
            String key = Base64.getEncoder().encodeToString(new byte[length]);
            assertThatCode(() -> invariant(true, true, key, "", "localhost").validate())
                .doesNotThrowAnyException();
        }
    }

    @Test
    void mailEnabledWithoutResendOrRealSmtpWarnsButDoesNotFail() {
        // Loopback SMTP is a legitimate local-relay choice, so the invariant
        // warns instead of failing — only the outbox contract is fail-fast.
        assertThatCode(() -> invariant(true, false, "", "", "localhost").validate())
            .doesNotThrowAnyException();
        assertThatCode(() -> invariant(true, false, "", "", "127.0.0.1").validate())
            .doesNotThrowAnyException();
        assertThatCode(() -> invariant(true, false, "", "", "smtp.hospital.example").validate())
            .doesNotThrowAnyException();
        assertThatCode(() -> invariant(true, false, "", "resend-key", "localhost").validate())
            .doesNotThrowAnyException();
    }

    private static MailDeliveryStartupInvariant invariant(
            boolean mailEnabled,
            boolean outboxEnabled,
            String encryptionKey,
            String resendApiKey,
            String smtpHost) {
        return new MailDeliveryStartupInvariant(
            mailEnabled, outboxEnabled, encryptionKey, resendApiKey, smtpHost);
    }
}
