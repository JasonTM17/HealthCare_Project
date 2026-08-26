package com.healthcare.storage.service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Generates opaque, thread-scoped keys and verifies their authenticity after a
 * request comes back from a browser or an asynchronous worker.
 */
public final class ConsultationObjectKeyGenerator {

    private static final String PREFIX = "private/consultations/";
    private static final Pattern KEY_PATTERN = Pattern.compile(
            "^private/consultations/([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/"
                    + "(upload|verified)/([A-Za-z0-9_-]{43})\\.([0-9a-f]{64})$");
    private final byte[] signingSecret;
    private final SecureRandom random;

    public ConsultationObjectKeyGenerator(String configuredSecret) {
        this(configuredSecret, new SecureRandom());
    }

    ConsultationObjectKeyGenerator(String configuredSecret, SecureRandom random) {
        this.random = random == null ? new SecureRandom() : random;
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            this.signingSecret = configuredSecret.getBytes(StandardCharsets.UTF_8);
        } else {
            byte[] generated = new byte[32];
            this.random.nextBytes(generated);
            this.signingSecret = generated;
        }
    }

    public String generate(UUID threadId, UUID attachmentId) {
        return generateUpload(threadId, attachmentId);
    }

    public String generateUpload(UUID threadId, UUID attachmentId) {
        return generate(threadId, attachmentId, Purpose.UPLOAD);
    }

    public String generateVerified(UUID threadId, UUID attachmentId) {
        return generate(threadId, attachmentId, Purpose.VERIFIED);
    }

    private String generate(UUID threadId, UUID attachmentId, Purpose purpose) {
        if (threadId == null || attachmentId == null) {
            throw new IllegalArgumentException("threadId and attachmentId are required");
        }
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        String payload = threadId + "/" + attachmentId + "/" + purpose.pathSegment() + "/" + token;
        return PREFIX + payload + "." + sign(payload);
    }

    public boolean isValid(String objectKey, UUID expectedThreadId, UUID expectedAttachmentId) {
        return isValid(objectKey, null, expectedThreadId, expectedAttachmentId);
    }

    public boolean isValid(
            String objectKey,
            Purpose expectedPurpose,
            UUID expectedThreadId,
            UUID expectedAttachmentId) {
        ParsedKey parsed = parse(objectKey);
        if (parsed == null) {
            return false;
        }
        if (expectedPurpose != null && expectedPurpose != parsed.purpose()) {
            return false;
        }
        if (expectedThreadId != null && !expectedThreadId.equals(parsed.threadId())) {
            return false;
        }
        if (expectedAttachmentId != null && !expectedAttachmentId.equals(parsed.attachmentId())) {
            return false;
        }
        String payload = parsed.threadId() + "/" + parsed.attachmentId() + "/"
                + parsed.purpose().pathSegment() + "/" + parsed.token();
        return constantTimeEquals(parsed.signature(), sign(payload));
    }

    public ParsedKey parse(String objectKey) {
        if (objectKey == null || objectKey.length() > 512) {
            return null;
        }
        Matcher matcher = KEY_PATTERN.matcher(objectKey);
        if (!matcher.matches()) {
            return null;
        }
        try {
            return new ParsedKey(
                    UUID.fromString(matcher.group(1)),
                    UUID.fromString(matcher.group(2)),
                    Purpose.fromPathSegment(matcher.group(3)),
                    matcher.group(4),
                    matcher.group(5));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public enum Purpose {
        UPLOAD("upload"),
        VERIFIED("verified");

        private final String pathSegment;

        Purpose(String pathSegment) {
            this.pathSegment = pathSegment;
        }

        String pathSegment() {
            return pathSegment;
        }

        static Purpose fromPathSegment(String value) {
            for (Purpose purpose : values()) {
                if (purpose.pathSegment.equals(value)) {
                    return purpose;
                }
            }
            throw new IllegalArgumentException("Unsupported object-key purpose");
        }
    }

    public record ParsedKey(
            UUID threadId, UUID attachmentId, Purpose purpose, String token, String signature) {
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingSecret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to sign private object key", ex);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        byte[] a = left.getBytes(StandardCharsets.US_ASCII);
        byte[] b = right.getBytes(StandardCharsets.US_ASCII);
        return java.security.MessageDigest.isEqual(a, b);
    }
}
