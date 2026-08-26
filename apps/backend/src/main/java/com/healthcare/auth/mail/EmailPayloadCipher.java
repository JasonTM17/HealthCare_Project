package com.healthcare.auth.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Mac;

/** AES-GCM envelope for email recipient and template variables. */
@Component
public class EmailPayloadCipher {

    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();
    private final byte[] key;

    public EmailPayloadCipher(ObjectMapper objectMapper,
                              @Value("${app.mail.outbox.encryption-key:}") String configuredKey) {
        this.objectMapper = objectMapper;
        this.key = decodeKey(configuredKey);
    }

    public boolean isConfigured() {
        return key != null;
    }

    public EncryptedPayload encrypt(EmailOutboxPayload payload) {
        if (key == null) throw new IllegalStateException("Email outbox encryption key is not configured");
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
            byte[] clear = objectMapper.writeValueAsBytes(payload);
            return new EncryptedPayload(cipher.doFinal(clear), nonce);
        } catch (Exception exception) {
            throw new IllegalStateException("Email outbox encryption failed", exception);
        }
    }

    public EmailOutboxPayload decrypt(byte[] ciphertext, byte[] nonce) {
        if (key == null) throw new IllegalStateException("Email outbox encryption key is not configured");
        if (ciphertext == null || nonce == null) throw new IllegalArgumentException("Encrypted payload is missing");
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
            return objectMapper.readValue(cipher.doFinal(ciphertext), EmailOutboxPayload.class);
        } catch (GeneralSecurityException | java.io.IOException exception) {
            throw new IllegalStateException("Email outbox decryption failed", exception);
        }
    }

    /** Keyed binding used only for idempotency replay; clear variables never leave this process. */
    public String digest(EmailOutboxPayload payload) {
        if (key == null) throw new IllegalStateException("Email outbox encryption key is not configured");
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] clear = objectMapper.writeValueAsBytes(new EmailOutboxPayload(
                payload.recipient(), new java.util.TreeMap<>(payload.variables())));
            return java.util.HexFormat.of().formatHex(mac.doFinal(clear));
        } catch (Exception exception) {
            throw new IllegalStateException("Email outbox digest failed", exception);
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

    public record EncryptedPayload(byte[] ciphertext, byte[] nonce) { }
}
