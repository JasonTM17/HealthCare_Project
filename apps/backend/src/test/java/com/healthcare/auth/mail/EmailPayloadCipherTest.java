package com.healthcare.auth.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmailPayloadCipherTest {

    @Test
    void roundTripsEncryptedPayloadAndUsesDifferentNoncePerMessage() {
        String key = Base64.getEncoder().encodeToString(new byte[32]);
        EmailPayloadCipher cipher = new EmailPayloadCipher(new ObjectMapper(), key);
        EmailOutboxPayload payload = new EmailOutboxPayload("patient@example.test", java.util.Map.of(
            "code", "123456", "minutes", "5"));

        EmailPayloadCipher.EncryptedPayload first = cipher.encrypt(payload);
        EmailPayloadCipher.EncryptedPayload second = cipher.encrypt(payload);

        assertEquals(payload, cipher.decrypt(first.ciphertext(), first.nonce()));
        assertEquals("123456", cipher.decrypt(first.ciphertext(), first.nonce()).variables().get("code"));
        org.junit.jupiter.api.Assertions.assertFalse(java.util.Arrays.equals(first.nonce(), second.nonce()));
        assertThrows(IllegalStateException.class, () -> cipher.decrypt(first.ciphertext(), second.nonce()));
    }

    @Test
    void missingOrInvalidKeyFailsClosed() {
        EmailPayloadCipher cipher = new EmailPayloadCipher(new ObjectMapper(), "not-base64-key");
        org.junit.jupiter.api.Assertions.assertFalse(cipher.isConfigured());
        assertThrows(IllegalStateException.class, () -> cipher.encrypt(
            new EmailOutboxPayload("a@example.test", java.util.Map.of("message", "b"))));
    }
}
