package com.healthcare.auth.mail;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.repository.NotificationPreferenceRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Transactional writer for the encrypted email outbox. */
@Service
public class EmailOutboxService {

    private static final long DEFAULT_TTL_SECONDS = 900;
    private final EmailOutboxRepository repository;
    private final EmailPayloadCipher cipher;
    private final NotificationPreferenceRepository preferences;

    public EmailOutboxService(EmailOutboxRepository repository, EmailPayloadCipher cipher) {
        this(repository, cipher, null);
    }

    @Autowired
    public EmailOutboxService(EmailOutboxRepository repository,
                              EmailPayloadCipher cipher,
                              NotificationPreferenceRepository preferences) {
        this.repository = repository;
        this.cipher = cipher;
        this.preferences = preferences;
    }

    @Transactional
    public EmailOutboxEntry enqueue(EmailTemplateKey templateKey,
                                    String recipient,
                                    Map<String, String> variables,
                                    String idempotencyKey,
                                    UUID userId,
                                    UUID eventReferenceId,
                                    String eventType,
                                    long ttlSeconds) {
        if (templateKey == null || recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("Email template and recipient are required");
        }
        String key = requireKey(idempotencyKey);
        enforcePreference(templateKey, userId);
        if (!cipher.isConfigured()) {
            throw new IllegalStateException("Email outbox encryption is not configured");
        }
        EmailOutboxPayload payload = new EmailOutboxPayload(recipient, variables);
        String payloadDigest = cipher.digest(payload);
        var existing = repository.findByIdempotencyKey(key);
        if (existing.isPresent()) {
            return requireSameLogicalEvent(existing.get(), templateKey, userId, eventReferenceId, eventType, payloadDigest);
        }
        EmailPayloadCipher.EncryptedPayload encrypted = cipher.encrypt(
            payload
        );
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusSeconds(Math.max(60, Math.min(ttlSeconds, 86_400)));
        repository.insertQueuedIfAbsent(
            UUID.randomUUID(), userId, eventReferenceId, eventType,
            templateKey.name(), templateKey.templateVersion(), key,
            encrypted.ciphertext(), encrypted.nonce(), payloadDigest,
            "healthcare-outbox-" + UUID.randomUUID(), now, expiresAt, now, now
        );

        // In PostgreSQL READ COMMITTED, a conflicting INSERT waits for the
        // winning unique-key transaction. This read therefore observes either
        // our row or the already-committed winner without surfacing a duplicate
        // key error to the business transaction.
        EmailOutboxEntry persisted = repository.findByIdempotencyKey(key)
            .orElseThrow(() -> new IllegalStateException("Email outbox insert was not observable"));
        return requireSameLogicalEvent(persisted, templateKey, userId, eventReferenceId, eventType, payloadDigest);
    }

    private void enforcePreference(EmailTemplateKey templateKey, UUID userId) {
        if (userId == null || !templateKey.category().suppressible()
                || preferences == null || templateKey.preferenceCategory() == null) return;
        preferences.ensureDefaults(userId);
        NotificationPreference preference = preferences.findById(
            new com.healthcare.notification.entity.NotificationPreferenceId(
                userId, templateKey.preferenceCategory(), NotificationChannel.EMAIL))
            .orElse(null);
        if (preference != null && !preference.isEnabled()) {
            throw new EmailDeliverySuppressedException();
        }
    }

    /** Compatibility boundary used by existing auth/payment callers. */
    @Transactional
    public EmailOutboxEntry enqueue(String recipient, String subject, String body) {
        String idempotency = digest(recipient + "\n" + subject + "\n" + body);
        return enqueue(EmailTemplateKey.SYSTEM_NOTIFICATION, recipient,
            Map.of("message", body == null ? "" : body), idempotency, null, null,
            "SYSTEM_NOTIFICATION", DEFAULT_TTL_SECONDS);
    }

    private static String requireKey(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Idempotency key is required");
        return value.trim();
    }

    static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to create email idempotency key", exception);
        }
    }

    static String templateIdempotencyKey(EmailTemplateKey templateKey,
                                         String recipient,
                                         Map<String, String> variables) {
        String canonicalVariables = (variables == null ? Map.<String, String>of() : variables)
            .entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> entry.getKey() + "=" + entry.getValue())
            .collect(java.util.stream.Collectors.joining("\n"));
        return digest(templateKey.name() + "\n" + recipient.trim().toLowerCase(java.util.Locale.ROOT)
            + "\n" + canonicalVariables);
    }

    private static EmailOutboxEntry requireSameLogicalEvent(EmailOutboxEntry existing,
                                                             EmailTemplateKey templateKey,
                                                             UUID userId,
                                                             UUID eventReferenceId,
                                                             String eventType,
                                                             String payloadDigest) {
        if (existing.getTemplateKey() != templateKey
                || existing.getTemplateVersion() != templateKey.templateVersion()
                || !Objects.equals(existing.getUserId(), userId)
                || !Objects.equals(existing.getEventReferenceId(), eventReferenceId)
                || !Objects.equals(existing.getEventType(), eventType)
                // V44 rows may predate payload binding. They are terminally
                // immutable and must fail closed instead of accepting a replay
                // with a different recipient or encrypted variables.
                || existing.getPayloadDigest() == null
                || !Objects.equals(existing.getPayloadDigest(), payloadDigest)) {
            throw new IllegalStateException("Email idempotency key is already bound to another event");
        }
        return existing;
    }
}
