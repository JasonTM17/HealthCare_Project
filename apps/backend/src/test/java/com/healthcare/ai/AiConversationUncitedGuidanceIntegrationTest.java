package com.healthcare.ai;

import com.healthcare.AbstractRedisIntegrationTest;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.service.ChatRequestCancellation;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.ai.service.AiService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * B7: a patient hospital-support question that matches no catalog source must
 * still receive a real answer when the remote provider is enabled — the same
 * uncited general-guidance lane the public surface already uses — while every
 * guard stays in place: intent GENERAL only, remote provenance only, no charge
 * when the provider could not answer, and the diagnose/prescribe reject.
 *
 * <p>This class owns a second Spring context because the shared test profile
 * pins {@code ai.chat.remote-provider-enabled=false}; the fail-closed posture
 * of the default profile is pinned separately in
 * {@code AiConversationIntegrationTest}.
 */
@TestPropertySource(properties = {
    "app.security.bff.service-token=test-bff-chat-commit-token-32-bytes-minimum",
    "ai.chat.remote-provider-enabled=true"
})
class AiConversationUncitedGuidanceIntegrationTest extends AbstractRedisIntegrationTest {

    private static final String GENERAL_QUESTION = "Uống bao nhiêu nước mỗi ngày?";
    private static final String GENERAL_ANSWER =
        "Người lớn nên uống khoảng 1,5-2 lít nước mỗi ngày, tùy thời tiết và mức vận động.";

    @MockitoBean
    private AiService aiService;

    @BeforeEach
    void configureRetrievalDouble() {
        // The retrieval half succeeds but re-authorizes zero sources: this is
        // exactly the catalog miss that used to end in INSUFFICIENT_EVIDENCE.
        when(aiService.retrieveChat(any()))
            .thenReturn(Map.of("safety_action", "ANSWER", "candidates", List.of()));
        when(aiService.retrieveChat(any(), any()))
            .thenAnswer(invocation -> aiService.retrieveChat(invocation.getArgument(0)));
    }

    @Test
    @WithMockUser(username = "patient.uncited-general@example.com", roles = "PATIENT")
    void generalQuestionWithoutCatalogSourceIsAnsweredByTheRemoteProviderAndCharged() throws Exception {
        User patient = createUser("patient.uncited-general@example.com");
        createPatientProfile(patient, "0901002301", 3);
        when(aiService.generateChat(any(), any())).thenReturn(remoteAnswer(GENERAL_ANSWER));

        String conversationId = createConversation();

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "uncited-general-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + GENERAL_QUESTION + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("ANSWER"))
            .andExpect(jsonPath("$.assistantMessage.provenance").value("remote_provider"))
            .andExpect(jsonPath("$.assistantMessage.content").value(GENERAL_ANSWER))
            .andExpect(jsonPath("$.assistantMessage.citations").isEmpty())
            .andExpect(jsonPath("$.assistantMessage.costTier").value("remote_llm"));

        @SuppressWarnings({"unchecked", "rawtypes"})
        ArgumentCaptor<Map<String, Object>> payload = (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
        verify(aiService).generateChat(payload.capture(), any(ChatRequestCancellation.class));
        // An uncited turn must never smuggle a source allowlist to the provider.
        assertThat(payload.getValue()).doesNotContainKey("authorized_sources");
        assertThat(payload.getValue()).containsEntry("message", GENERAL_QUESTION);

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(2);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isEqualTo(1);
        assertThat(ledgerBalanceAfter(patient.getId(), "AI_CHAT_USAGE")).isEqualTo(2);
    }

    @Test
    @WithMockUser(username = "patient.uncited-booking@example.com", roles = "PATIENT")
    void nonGeneralIntentKeepsInsufficientEvidenceAndNeverCallsTheProvider() throws Exception {
        User patient = createUser("patient.uncited-booking@example.com");
        createPatientProfile(patient, "0901002302", 3);
        when(aiService.generateChat(any(), any())).thenReturn(remoteAnswer(GENERAL_ANSWER));

        String conversationId = createConversation();

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "uncited-booking-0001")
                .contentType(MediaType.APPLICATION_JSON)
                // BOOKING is deliberately not GENERAL; the content floor in the
                // AI service would allow it, so only the Spring intent gate can
                // keep it source-bound.
                .content("{\"content\":\"Tôi muốn đặt lịch khám\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.assistantMessage.citations").isEmpty());

        verify(aiService, never()).generateChat(any(), any());
        verify(aiService, never()).generateChatStream(any(), any(), any());
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "patient.uncited-zero-credit@example.com", roles = "PATIENT")
    void zeroCreditPatientStillFailsClosedBeforeAnyProviderWork() throws Exception {
        User patient = createUser("patient.uncited-zero-credit@example.com");
        createPatientProfile(patient, "0901002303", 0);

        String conversationId = createConversation();

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "uncited-zero-credit-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + GENERAL_QUESTION + "\"}"))
            .andExpect(status().isPaymentRequired())
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_AI_CREDITS"));

        verify(aiService, never()).retrieveChat(any(), any());
        verify(aiService, never()).generateChat(any(), any());
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits()).isZero();
        assertThat(creditTransactionCount(patient.getId())).isZero();
    }

    @Test
    @WithMockUser(username = "patient.uncited-unsafe@example.com", roles = "PATIENT")
    void prescriptionClaimInAnUncitedAnswerIsRejectedAndNotCharged() throws Exception {
        User patient = createUser("patient.uncited-unsafe@example.com");
        createPatientProfile(patient, "0901002304", 3);
        when(aiService.generateChat(any(), any()))
            .thenReturn(remoteAnswer("Bạn nên uống 500mg kháng sinh mỗi ngày để phòng bệnh."));

        String conversationId = createConversation();

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "uncited-unsafe-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + GENERAL_QUESTION + "\"}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("CHAT_CONTENT_BLOCKED"));

        assertThat(aiMessageRepository.findAll())
            .filteredOn(message -> message.getRole() == AiMessageRole.ASSISTANT)
            .isEmpty();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
    }

    @Test
    @WithMockUser(username = "patient.uncited-local@example.com", roles = "PATIENT")
    void localFallbackProvenanceIsNotDisplayedAndIsWaived() throws Exception {
        User patient = createUser("patient.uncited-local@example.com");
        createPatientProfile(patient, "0901002305", 3);
        when(aiService.generateChat(any(), any())).thenReturn(Map.of(
            "answer", "Bạn nên uống đủ nước mỗi ngày.",
            "provenance", "local_fallback",
            "safety_action", "ANSWER",
            "cost_tier", "local_free"
        ));

        String conversationId = createConversation();

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "uncited-local-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + GENERAL_QUESTION + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.assistantMessage.provenance").value("local_fallback"));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
    }

    private Map<String, Object> remoteAnswer(String answer) {
        return Map.of(
            "answer", answer,
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "cost_tier", "remote_llm"
        );
    }

    private String createConversation() throws Exception {
        return mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");
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

    private PatientProfile createPatientProfile(User user, String phone, int credits) {
        PatientProfile profile = new PatientProfile();
        profile.setUserId(user.getId());
        profile.setFullName("Test Patient");
        profile.setEmail(user.getEmail());
        profile.setPhone(phone);
        profile.setAiCredits(credits);
        profile.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        // Same guard as the sibling integration test: pin the current ISO
        // period so the weekly refill is a no-op and the seeded balance is
        // exactly what the assertions below read.
        profile.setLastCreditRefillPeriod(AiCreditService.currentRefillPeriod());
        return patientProfileRepository.save(profile);
    }

    private long creditTransactionCount(UUID userId) {
        Long count = jdbcTemplate.queryForObject(
            "select count(*) from ai_credit_transactions where user_id = ?",
            Long.class,
            userId
        );
        return count == null ? 0 : count;
    }

    private long creditTransactionCount(UUID userId, String transactionType) {
        Long count = jdbcTemplate.queryForObject(
            "select count(*) from ai_credit_transactions where user_id = ? and transaction_type = ?",
            Long.class,
            userId,
            transactionType
        );
        return count == null ? 0 : count;
    }

    private int ledgerBalanceAfter(UUID userId, String transactionType) {
        Integer balance = jdbcTemplate.queryForObject(
            "select balance_after from ai_credit_transactions"
                + " where user_id = ? and transaction_type = ?"
                + " order by created_at desc, id desc limit 1",
            Integer.class,
            userId,
            transactionType
        );
        return balance == null ? -1 : balance;
    }
}
