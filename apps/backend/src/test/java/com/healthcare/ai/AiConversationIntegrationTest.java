package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.ai.chat.entity.AiConversation;
import com.healthcare.ai.chat.entity.AiConversationStatus;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import com.healthcare.ai.chat.service.AiConversationService;
import com.healthcare.ai.service.AiService;
import com.healthcare.exception.BusinessException;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AiConversationIntegrationTest extends AbstractIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @Autowired
    private AiConversationService conversationService;

    @BeforeEach
    void configureLegacyProviderDouble() {
        // Patient chat must always enter through the retrieval authorization
        // boundary.  A deterministic safety response keeps ordinary tests
        // local and provider-free while concurrency tests below override this
        // same retrieval call with their latch-controlled schedule.
        when(aiService.retrieveChat(any())).thenReturn(Map.of("safety_action", "REFUSE"));
    }

    @Test
    @WithMockUser(username = "patient.legacy-chat@example.com", roles = "PATIENT")
    void patientCannotBypassPersistentHistoryThroughLegacyChat() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Toi can thong tin tham khao\",\"recent_history\":[]}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "patient.invalid-mode@example.com", roles = "PATIENT")
    void invalidChatModeHasStableMachineReadableError() throws Exception {
        createUser("patient.invalid-mode@example.com");

        mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"NOT_A_CHAT_MODE\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("CHAT_MODE_INVALID"));
    }

    @Test
    @WithMockUser(username = "patient.rollback-mode@example.com", roles = "PATIENT")
    void disabledClinicalModeFailsClosedBeforeCreatingConversation() throws Exception {
        createUser("patient.rollback-mode@example.com");

        mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"SYMPTOM_TRIAGE\"}"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));

        assertThat(aiConversationRepository.findAll()).isEmpty();
    }

    @Test
    @WithMockUser(username = "patient.remote-policy@example.com", roles = "PATIENT")
    void patientPolicyKeepsRemoteProviderDisabledByDefault() throws Exception {
        createUser("patient.remote-policy@example.com");

        mockMvc.perform(get("/api/v1/ai/chat-policy"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.policyVersion").value("patient-chat-v1"))
            .andExpect(jsonPath("$.retentionDays").value(90))
            .andExpect(jsonPath("$.remoteProviderEnabled").value(false));
    }

    @Test
    @WithMockUser(username = "patient.invalid-feedback@example.com", roles = "PATIENT")
    void invalidFeedbackRatingHasStableMachineReadableError() throws Exception {
        createUser("patient.invalid-feedback@example.com");

        mockMvc.perform(put("/api/v1/ai/conversations/{conversationId}/messages/{messageId}/feedback",
                UUID.randomUUID(), UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":\"NOT_A_RATING\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("CHAT_FEEDBACK_INVALID"));
    }

    @Test
    @WithMockUser(username = "doctor.legacy-chat@example.com", roles = "DOCTOR")
    void doctorRetainsControlledLegacySingleTurnChat() throws Exception {
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Thong tin tham khao",
            "provenance", "local_fallback",
            "citations", List.of()
        ));

        mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Toi can thong tin tham khao\",\"recent_history\":[]}"))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "patient.chat@example.com", roles = "PATIENT")
    void createsConversationAndReplaysTheSameIdempotentExchange() throws Exception {
        createUser("patient.chat@example.com");
        when(aiService.retrieveChat(any())).thenReturn(Map.of("safety_action", "REFUSE"));

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Cuoc tro chuyen moi"))
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String endpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "chat-request-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi bi dau dau nhe\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false))
            .andExpect(jsonPath("$.assistantMessage.provenance").value("local_provider"));

        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "chat-request-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi bi dau dau nhe\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(true));

        assertThat(aiMessageRepository.findAll()).hasSize(2);
    }

    @Test
    @WithMockUser(username = "patient.owner@example.com", roles = "PATIENT")
    void hidesAnotherPatientsConversationAsNotFound() throws Exception {
        createUser("patient.owner@example.com");
        User other = createUser("patient.other@example.com");
        AiConversation conversation = createConversation(other, false, OffsetDateTime.now(ZoneOffset.UTC).plusDays(90));

        mockMvc.perform(get("/api/v1/ai/conversations/{id}", conversation.getId()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("AI_CONVERSATION_NOT_FOUND"));

        mockMvc.perform(delete("/api/v1/ai/conversations/{id}", conversation.getId()))
            .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "doctor.chat@example.com", roles = "DOCTOR")
    void rejectsNonPatientRole() throws Exception {
        createUser("doctor.chat@example.com");

        mockMvc.perform(get("/api/v1/ai/conversations"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "patient.busy@example.com", roles = "PATIENT")
    void rejectsConcurrentMessageAndDifferentContentForUsedKey() throws Exception {
        User patient = createUser("patient.busy@example.com");
        AiConversation conversation = createConversation(patient, true, OffsetDateTime.now(ZoneOffset.UTC).plusDays(90));

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages", conversation.getId())
                .header("Idempotency-Key", "chat-request-busy")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Xin tu van\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CHAT_MESSAGE_IN_PROGRESS"));

        conversation.setInFlight(false);
        conversation.setInFlightStartedAt(null);
        conversation.setInFlightToken(null);
        aiConversationRepository.save(conversation);
        AiMessage prior = new AiMessage();
        prior.setConversation(conversation);
        prior.setRole(AiMessageRole.USER);
        prior.setStatus(AiMessageStatus.FAILED);
        prior.setContent("Noi dung cu");
        prior.setSequenceNumber(1);
        prior.setIdempotencyKey("chat-request-conflict");
        prior.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        prior.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
        aiMessageRepository.save(prior);

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages", conversation.getId())
                .header("Idempotency-Key", "chat-request-conflict")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Noi dung khac\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CHAT_IDEMPOTENCY_CONFLICT"));
    }

    @Test
    @WithMockUser(username = "patient.stale@example.com", roles = "PATIENT")
    void recoversAStaleProcessingLeaseBeforeAcceptingANewMessage() throws Exception {
        User patient = createUser("patient.stale@example.com");
        AiConversation conversation = createConversation(patient, true, OffsetDateTime.now(ZoneOffset.UTC).plusDays(90));
        conversation.setInFlightStartedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        aiConversationRepository.saveAndFlush(conversation);

        AiMessage stale = new AiMessage();
        stale.setConversation(conversation);
        stale.setRole(AiMessageRole.USER);
        stale.setStatus(AiMessageStatus.PENDING);
        stale.setContent("Old pending question");
        stale.setSequenceNumber(1);
        stale.setIdempotencyKey("stale-request-0001");
        stale.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        stale = aiMessageRepository.saveAndFlush(stale);

        when(aiService.retrieveChat(any())).thenReturn(Map.of("safety_action", "REFUSE"));

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages", conversation.getId())
                .header("Idempotency-Key", "fresh-request-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"New question after recovery\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false));

        assertThat(aiMessageRepository.findById(stale.getId()).orElseThrow().getStatus())
            .isEqualTo(AiMessageStatus.FAILED);
        AiConversation recovered = aiConversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(recovered.isInFlight()).isFalse();
        assertThat(recovered.getInFlightStartedAt()).isNull();
        assertThat(recovered.getInFlightToken()).isNull();
    }

    @Test
    void rejectsAnExpiredResponseBeforeAReplacementCompletes() throws Exception {
        User patient = createUser("patient.expired-lease@example.com");
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        var principal = org.springframework.security.core.userdetails.User
            .withUsername(patient.getEmail())
            .password("unused")
            .roles("PATIENT")
            .build();
        CountDownLatch firstProviderCallStarted = new CountDownLatch(1);
        CountDownLatch releaseFirstProviderCall = new CountDownLatch(1);
        AtomicInteger providerCalls = new AtomicInteger();

        when(aiService.retrieveChat(any())).thenAnswer(invocation -> {
            int call = providerCalls.incrementAndGet();
            if (call == 1) {
                firstProviderCallStarted.countDown();
                if (!releaseFirstProviderCall.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting to release the expired provider response");
                }
            }
            return Map.of("safety_action", "REFUSE");
        });

        CompletableFuture<Object> expiredAttempt = CompletableFuture.supplyAsync(() -> {
            try {
                return conversationService.send(
                    principal,
                    conversation.getId(),
                    "expired-request-0001",
                    "First slow question"
                );
            } catch (RuntimeException ex) {
                return ex;
            }
        });

        assertThat(firstProviderCallStarted.await(5, TimeUnit.SECONDS)).isTrue();
        AiConversation leased = aiConversationRepository.findById(conversation.getId()).orElseThrow();
        leased.setInFlightStartedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        aiConversationRepository.saveAndFlush(leased);

        releaseFirstProviderCall.countDown();
        Object expiredResult = expiredAttempt.get(5, TimeUnit.SECONDS);
        var current = conversationService.send(
            principal,
            conversation.getId(),
            "expired-request-0002",
            "Second current question"
        );

        assertThat(expiredResult).isInstanceOf(BusinessException.class);
        assertThat(((BusinessException) expiredResult).getCode()).isEqualTo("AI_UNAVAILABLE");
        assertThat(current.assistantMessage().safetyAction().name()).isEqualTo("REFUSE");
        assertThat(aiMessageRepository.findAll())
            .filteredOn(message -> message.getRole() == AiMessageRole.ASSISTANT)
            .singleElement()
            .extracting(AiMessage::getSafetyAction)
            .isEqualTo(com.healthcare.ai.chat.entity.ChatSafetyAction.REFUSE);
    }

    @Test
    void rejectsALateResponseAfterItsLeaseWasReplaced() throws Exception {
        User patient = createUser("patient.fencing@example.com");
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        var principal = org.springframework.security.core.userdetails.User
            .withUsername(patient.getEmail())
            .password("unused")
            .roles("PATIENT")
            .build();
        CountDownLatch firstProviderCallStarted = new CountDownLatch(1);
        CountDownLatch releaseFirstProviderCall = new CountDownLatch(1);
        AtomicInteger providerCalls = new AtomicInteger();

        when(aiService.retrieveChat(any())).thenAnswer(invocation -> {
            int call = providerCalls.incrementAndGet();
            if (call == 1) {
                firstProviderCallStarted.countDown();
                if (!releaseFirstProviderCall.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting to release the stale provider response");
                }
            }
            return Map.of("safety_action", "REFUSE");
        });

        CompletableFuture<Object> staleAttempt = CompletableFuture.supplyAsync(() -> {
            try {
                return conversationService.send(
                    principal,
                    conversation.getId(),
                    "fencing-request-0001",
                    "First slow question"
                );
            } catch (RuntimeException ex) {
                return ex;
            }
        });

        assertThat(firstProviderCallStarted.await(5, TimeUnit.SECONDS)).isTrue();
        AiConversation leased = aiConversationRepository.findById(conversation.getId()).orElseThrow();
        leased.setInFlightStartedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        aiConversationRepository.saveAndFlush(leased);

        var current = conversationService.send(
            principal,
            conversation.getId(),
            "fencing-request-0002",
            "Second current question"
        );
        releaseFirstProviderCall.countDown();
        Object staleResult = staleAttempt.get(5, TimeUnit.SECONDS);

        assertThat(current.assistantMessage().safetyAction().name()).isEqualTo("REFUSE");
        assertThat(staleResult).isInstanceOf(BusinessException.class);
        assertThat(((BusinessException) staleResult).getCode()).isEqualTo("AI_UNAVAILABLE");
        assertThat(aiMessageRepository.findAll())
            .filteredOn(message -> message.getRole() == AiMessageRole.ASSISTANT)
            .singleElement()
            .extracting(AiMessage::getSafetyAction)
            .isEqualTo(com.healthcare.ai.chat.entity.ChatSafetyAction.REFUSE);
        AiConversation completed = aiConversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(completed.isInFlight()).isFalse();
        assertThat(completed.getInFlightToken()).isNull();
    }

    @Test
    void deletesConversationWhileProviderCallIsOutstandingWithoutResurrection() throws Exception {
        User patient = createUser("patient.delete-in-flight@example.com");
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        var principal = org.springframework.security.core.userdetails.User
            .withUsername(patient.getEmail())
            .password("unused")
            .roles("PATIENT")
            .build();
        CountDownLatch providerCallStarted = new CountDownLatch(1);
        CountDownLatch releaseProviderCall = new CountDownLatch(1);

        when(aiService.retrieveChat(any())).thenAnswer(invocation -> {
            providerCallStarted.countDown();
            if (!releaseProviderCall.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting to release deleted conversation response");
            }
            return Map.of("safety_action", "REFUSE");
        });

        CompletableFuture<Object> providerAttempt = CompletableFuture.supplyAsync(() -> {
            try {
                return conversationService.send(
                    principal,
                    conversation.getId(),
                    "delete-request-0001",
                    "Question deleted while processing"
                );
            } catch (RuntimeException ex) {
                return ex;
            }
        });

        assertThat(providerCallStarted.await(5, TimeUnit.SECONDS)).isTrue();
        Object deleteResult;
        try {
            conversationService.delete(principal, conversation.getId());
            deleteResult = null;
        } catch (RuntimeException ex) {
            deleteResult = ex;
        } finally {
            releaseProviderCall.countDown();
        }
        Object providerResult = providerAttempt.get(5, TimeUnit.SECONDS);

        assertThat(deleteResult).isNull();
        assertThat(providerResult).isInstanceOf(BusinessException.class);
        assertThat(aiConversationRepository.findById(conversation.getId())).isEmpty();
        assertThat(aiMessageRepository.findAll()).isEmpty();
    }

    @Test
    @WithMockUser(username = "patient.expired@example.com", roles = "PATIENT")
    void reportsExpiredConversationAndDeletesOwnedConversation() throws Exception {
        User patient = createUser("patient.expired@example.com");
        AiConversation expired = createConversation(patient, false, OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(1));

        mockMvc.perform(get("/api/v1/ai/conversations/{id}", expired.getId()))
            .andExpect(status().isGone())
            .andExpect(jsonPath("$.code").value("CHAT_RETENTION_EXPIRED"));

        mockMvc.perform(delete("/api/v1/ai/conversations/{id}", expired.getId()))
            .andExpect(status().isNoContent());
        assertThat(aiConversationRepository.findById(expired.getId())).isEmpty();

        AiConversation active = createConversation(patient, false, OffsetDateTime.now(ZoneOffset.UTC).plusDays(90));
        mockMvc.perform(delete("/api/v1/ai/conversations/{id}", active.getId()))
            .andExpect(status().isNoContent());
        assertThat(aiConversationRepository.findById(active.getId())).isEmpty();
    }

    @Test
    void purgesExpiredConversationsAcrossMultipleBatches() {
        User patient = createUser("patient.cleanup@example.com");
        OffsetDateTime expiredAt = OffsetDateTime.now(ZoneOffset.UTC).minusDays(1);
        for (int index = 0; index < 205; index++) {
            createConversation(patient, false, expiredAt.minusSeconds(index));
        }

        conversationService.purgeExpired();

        assertThat(aiConversationRepository.findAll()).isEmpty();
    }

    private User createUser(String email) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("test-password-hash");
        user.setDisplayName("Test Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private AiConversation createConversation(
            User user,
            boolean inFlight,
            OffsetDateTime expiresAt) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        AiConversation conversation = new AiConversation();
        conversation.setUser(user);
        conversation.setTitle("Test conversation");
        conversation.setStatus(AiConversationStatus.ACTIVE);
        conversation.setInFlight(inFlight);
        conversation.setInFlightStartedAt(inFlight ? now : null);
        conversation.setInFlightToken(inFlight ? UUID.randomUUID() : null);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(expiresAt);
        // Integration scenarios that exercise message processing represent a
        // patient who has already accepted the current policy.  Keep the
        // explicit API contract tests responsible for unconsented/legacy
        // coverage instead of weakening the runtime consent gate here.
        conversation.setConsentVersion("patient-chat-v1");
        conversation.setConsentedAt(now);
        return aiConversationRepository.save(conversation);
    }
}
