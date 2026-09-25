package com.healthcare.ai.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.security.JwtProperties;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ChatCommitPermitServiceTest {

    private static final String JWT_SECRET = "test-chat-commit-permit-secret-32-bytes-minimum";

    @Test
    void permitBindsTheExactRequestPatientConversationKeyAndPreparedPayload() {
        ChatCommitPermitService permits = new ChatCommitPermitService(
            new ObjectMapper(), new JwtProperties(JWT_SECRET, 300, 3_600));
        String requestId = UUID.randomUUID().toString();
        UUID patientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        String idempotencyKey = "patient-chat-0001";
        String payload = "{\"answer\":\"safe\"}";
        String permit = permits.issue(requestId, patientId, conversationId, idempotencyKey, payload);

        assertThat(permits.verifies(permit, requestId, patientId, conversationId, idempotencyKey, payload)).isTrue();
        assertThat(permits.verifies("x" + permit, requestId, patientId, conversationId, idempotencyKey, payload))
            .isFalse();
        assertThat(permits.verifies(permit, UUID.randomUUID().toString(), patientId, conversationId,
            idempotencyKey, payload)).isFalse();
        assertThat(permits.verifies(permit, requestId, UUID.randomUUID(), conversationId,
            idempotencyKey, payload)).isFalse();
        assertThat(permits.verifies(permit, requestId, patientId, UUID.randomUUID(),
            idempotencyKey, payload)).isFalse();
        assertThat(permits.verifies(permit, requestId, patientId, conversationId,
            "patient-chat-0002", payload)).isFalse();
        assertThat(permits.verifies(permit, requestId, patientId, conversationId,
            idempotencyKey, payload + " ")).isFalse();
    }

    @Test
    void permitExpiresAfterItsShortBoundedLifetime() {
        ChatCommitPermitService permits = new ChatCommitPermitService(
            new ObjectMapper(), new JwtProperties(JWT_SECRET, 300, 3_600));
        String requestId = UUID.randomUUID().toString();
        UUID patientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        String idempotencyKey = "patient-chat-0001";
        String payload = "{\"answer\":\"safe\"}";
        String permit = permits.issue(requestId, patientId, conversationId, idempotencyKey, payload);

        assertThat(permits.verifies(
            permit, requestId, patientId, conversationId, idempotencyKey, payload, Instant.now().plusSeconds(61)))
            .isFalse();
    }
}
