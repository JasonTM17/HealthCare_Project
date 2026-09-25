package com.healthcare.ai.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.security.JwtProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/** Signs short-lived, request-bound permission for one prepared patient-chat commit. */
@Component
public final class ChatCommitPermitService {

    private static final long PERMIT_TTL_SECONDS = 60;
    private static final String DERIVATION_LABEL = "healthcare:patient-chat-commit-permit:v1:";
    private final ObjectMapper objectMapper;
    private final byte[] signingKey;

    public ChatCommitPermitService(ObjectMapper objectMapper, JwtProperties jwtProperties) {
        this.objectMapper = objectMapper;
        String configuredSecret = jwtProperties.secret();
        if (configuredSecret == null || configuredSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secret must contain at least 32 bytes for chat commit permits");
        }
        this.signingKey = sha256((DERIVATION_LABEL + configuredSecret).getBytes(StandardCharsets.UTF_8));
    }

    public String issue(
            String requestId,
            UUID patientId,
            UUID conversationId,
            String idempotencyKey,
            String exactPreparedPayload) {
        Instant issuedAt = Instant.now();
        Claims claims = new Claims(
            1,
            requestId,
            patientId.toString(),
            conversationId.toString(),
            idempotencyKey,
            issuedAt.getEpochSecond(),
            issuedAt.plusSeconds(PERMIT_TTL_SECONDS).getEpochSecond(),
            hex(sha256(exactPreparedPayload.getBytes(StandardCharsets.UTF_8)))
        );
        try {
            byte[] serializedClaims = objectMapper.writeValueAsBytes(claims);
            String encodedClaims = Base64.getUrlEncoder().withoutPadding().encodeToString(serializedClaims);
            String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmac(encodedClaims.getBytes(StandardCharsets.US_ASCII)));
            return encodedClaims + "." + signature;
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign prepared patient-chat response", exception);
        }
    }

    public boolean verifies(
            String permit,
            String requestId,
            UUID patientId,
            UUID conversationId,
            String idempotencyKey,
            String exactPreparedPayload) {
        return verifies(
            permit, requestId, patientId, conversationId, idempotencyKey, exactPreparedPayload, Instant.now());
    }

    boolean verifies(
            String permit,
            String requestId,
            UUID patientId,
            UUID conversationId,
            String idempotencyKey,
            String exactPreparedPayload,
            Instant now) {
        if (permit == null || permit.length() > 4_096 || exactPreparedPayload == null) return false;
        String[] parts = permit.split("\\.", -1);
        if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty()) return false;
        try {
            byte[] suppliedSignature = Base64.getUrlDecoder().decode(parts[1]);
            byte[] expectedSignature = hmac(parts[0].getBytes(StandardCharsets.US_ASCII));
            if (!MessageDigest.isEqual(expectedSignature, suppliedSignature)) return false;

            byte[] claimsBytes = Base64.getUrlDecoder().decode(parts[0]);
            Claims claims = objectMapper.readValue(claimsBytes, Claims.class);
            long lifetime = claims.expiresAtEpochSecond() - claims.issuedAtEpochSecond();
            long nowEpochSecond = now.getEpochSecond();
            return claims.version() == 1
                && requestId.equals(claims.requestId())
                && patientId.toString().equals(claims.patientId())
                && conversationId.toString().equals(claims.conversationId())
                && idempotencyKey.equals(claims.idempotencyKey())
                && MessageDigest.isEqual(
                    claims.preparedPayloadSha256().getBytes(StandardCharsets.US_ASCII),
                    hex(sha256(exactPreparedPayload.getBytes(StandardCharsets.UTF_8)))
                        .getBytes(StandardCharsets.US_ASCII))
                && claims.issuedAtEpochSecond() <= nowEpochSecond + 5
                && claims.expiresAtEpochSecond() > nowEpochSecond
                && lifetime > 0
                && lifetime <= PERMIT_TTL_SECONDS;
        } catch (Exception ignored) {
            return false;
        }
    }

    private byte[] hmac(byte[] value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
        return mac.doFinal(value);
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String hex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format("%02x", item));
        return result.toString();
    }

    private record Claims(
        int version,
        String requestId,
        String patientId,
        String conversationId,
        String idempotencyKey,
        long issuedAtEpochSecond,
        long expiresAtEpochSecond,
        String preparedPayloadSha256
    ) {
    }
}
