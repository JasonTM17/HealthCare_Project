package com.healthcare.auth.mail;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Locale;
import java.util.Set;

/**
 * Fail-fast posture check for the mail delivery chain.
 *
 * <p>Two misconfigurations used to start green and fail at runtime inside
 * user-facing transactions:
 *
 * <ul>
 *   <li>{@code app.mail.outbox.enabled=true} with a missing or malformed
 *       {@code app.mail.outbox.encryption-key} made {@code EmailOutboxService.enqueue}
 *       throw {@code IllegalStateException} while registering, verifying,
 *       resetting passwords, or booking — every OTP path returned HTTP 500.
 *       The outbox is a declared contract, so the deployment refuses to boot.
 *   <li>{@code app.mail.enabled=true} with no {@code RESEND_API_KEY} and no
 *       non-loopback SMTP host silently fell back to {@code localhost:1025},
 *       so OTP and notification mail vanished while the app stayed "healthy".
 *       A real local relay is legitimate, so this path warns loudly instead
 *       of failing.
 * </ul>
 */
@Component
public class MailDeliveryStartupInvariant {

    private static final Logger log = LoggerFactory.getLogger(MailDeliveryStartupInvariant.class);
    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1", "[::1]");

    private final boolean mailEnabled;
    private final boolean outboxEnabled;
    private final String encryptionKey;
    private final String resendApiKey;
    private final String smtpHost;

    public MailDeliveryStartupInvariant(
            @Value("${app.mail.enabled:false}") boolean mailEnabled,
            @Value("${app.mail.outbox.enabled:false}") boolean outboxEnabled,
            @Value("${app.mail.outbox.encryption-key:}") String encryptionKey,
            @Value("${app.mail.resend-api-key:}") String resendApiKey,
            @Value("${spring.mail.host:localhost}") String smtpHost) {
        this.mailEnabled = mailEnabled;
        this.outboxEnabled = outboxEnabled;
        this.encryptionKey = encryptionKey;
        this.resendApiKey = resendApiKey;
        this.smtpHost = smtpHost;
    }

    @PostConstruct
    public void validate() {
        if (!mailEnabled) {
            log.info("Mail delivery disabled (app.mail.enabled=false); OTP flows will rely on non-mail paths.");
            return;
        }
        if (outboxEnabled && decodeKey(encryptionKey) == null) {
            throw new IllegalStateException(
                "app.mail.outbox.enabled=true requires app.mail.outbox.encryption-key "
                    + "(APP_MAIL_OUTBOX_ENCRYPTION_KEY) to be a base64-encoded 16/24/32-byte AES key; "
                    + "without it every OTP/booking enqueue fails inside the user-facing transaction");
        }
        if (resendApiKey == null || resendApiKey.isBlank()) {
            String host = smtpHost == null ? "" : smtpHost.trim();
            if (host.isEmpty() || LOOPBACK_HOSTS.contains(host.toLowerCase(Locale.ROOT))) {
                log.warn(
                    "app.mail.enabled=true but RESEND_API_KEY is unset and spring.mail.host='{}' is loopback. "
                        + "OTP and notification emails will silently fail to deliver; configure RESEND_API_KEY "
                        + "or a reachable SMTP relay before relying on mail.",
                    host.isEmpty() ? "localhost" : host
                );
            }
        }
    }

    private static byte[] decodeKey(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            byte[] decoded = Base64.getDecoder().decode(value.trim());
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) return decoded;
        } catch (IllegalArgumentException ignored) {
            // fall through to a fail-closed null key
        }
        return null;
    }
}
