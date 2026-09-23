package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.ai.chat.entity.AiConversation;
import com.healthcare.ai.chat.entity.AiConversationStatus;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import com.healthcare.ai.chat.service.AiConversationService;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.ai.service.AiService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.MedicalService;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AiConversationIntegrationTest extends AbstractIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @Autowired
    private AiConversationService conversationService;

    /**
     * The real ledger service, used by the refund-idempotency check: the
     * guarantee under test is the database state after two compensations for
     * the same attempt, which a mocked service could not demonstrate.
     */
    @Autowired
    private AiCreditService aiCreditService;

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
    void patientCannotBypassPersistentHistoryThroughRemovedLegacyChat() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Toi can thong tin tham khao\",\"recent_history\":[]}"))
            .andExpect(status().isNotFound());
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
    void doctorCannotUseRemovedLegacySingleTurnChat() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Toi can thong tin tham khao\",\"recent_history\":[]}"))
            .andExpect(status().isNotFound());
        verify(aiService, never()).chat(any());
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
            .andExpect(jsonPath("$.title").value("Cuộc trò chuyện mới"))
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
            .andExpect(jsonPath("$.assistantMessage.provenance").value("local_fallback"));

        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "chat-request-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi bi dau dau nhe\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(true));

        assertThat(aiMessageRepository.findAll()).hasSize(2);
    }

    @Test
    @WithMockUser(username = "patient.chat-retrieval-outage@example.com", roles = "PATIENT")
    void retrievalOutagePersistsAndReloadsInsufficientEvidenceInsteadOfAnUncitedAnswer() throws Exception {
        createUser("patient.chat-retrieval-outage@example.com");
        when(aiService.retrieveChat(any())).thenReturn(null);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String messagesEndpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        mockMvc.perform(post(messagesEndpoint)
                .header("Idempotency-Key", "retrieval-outage-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Bệnh viện có chuyên khoa nào?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.assistantMessage.sourceStatus").value("UNAVAILABLE"))
            .andExpect(jsonPath("$.assistantMessage.citations").isEmpty());

        mockMvc.perform(get(messagesEndpoint))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[1].safetyAction").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.content[1].sourceStatus").value("UNAVAILABLE"))
            .andExpect(jsonPath("$.content[1].citations").isEmpty());

        assertThat(aiMessageRepository.findAll())
            .filteredOn(message -> message.getRole() == AiMessageRole.ASSISTANT)
            .singleElement()
            .satisfies(message -> {
                assertThat(message.getSafetyAction())
                    .isEqualTo(com.healthcare.ai.chat.entity.ChatSafetyAction.INSUFFICIENT_EVIDENCE);
                assertThat(message.getCitations()).isEmpty();
                assertThat(message.getContent()).doesNotContain("nhịn ăn", "07:30", "Tim mạch");
            });
        verify(aiService, never()).generateChat(any());
        verify(aiService, never()).generateChatStream(any(), any());
    }

    @Test
    @WithMockUser(username = "patient.credit-replay@example.com", roles = "PATIENT")
    void idempotentReplayDoesNotDebitAgainEvenAfterBalanceReachesZero() throws Exception {
        User patient = createUser("patient.credit-replay@example.com");
        createPatientProfile(patient, "0901002001", 1);
        // Since audit A4 the static safety outcomes (REFUSE/EMERGENCY/
        // HUMAN_HANDOFF) are waived, not charged — so replay protection is
        // asserted on a grounded, cited answer, the path that still moves the
        // balance.
        MedicalService service = new MedicalService();
        service.setName("Tư vấn tổng quát");
        service.setSlug("tu-van-tong-quat-" + UUID.randomUUID());
        service.setDescription("Thông tin hỗ trợ đặt lịch tư vấn tổng quát.");
        service.setActive(true);
        service = serviceRepository.saveAndFlush(service);
        String sourceId = service.getId().toString();
        when(aiService.retrieveChat(any())).thenReturn(Map.of(
            "safety_action", "ANSWER",
            "candidates", List.of(Map.of(
                "source_type", "service",
                "source_id", sourceId,
                "projection_kind", "OPERATIONAL",
                "score", 1.0
            ))
        ));
        when(aiService.generateChat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể đặt lịch tư vấn tổng quát.",
            "provenance", "local_provider",
            "used_sources", List.of(Map.of(
                "source_type", "service",
                "source_id", sourceId,
                "projection_kind", "OPERATIONAL"))
        ));

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String endpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "credit-replay-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi can tu van suc khoe\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isEqualTo(1);

        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "credit-replay-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi can tu van suc khoe\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(true));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isZero();
        assertThat(creditTransactionCount(patient.getId())).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "patient.no-consent-credit@example.com", roles = "PATIENT")
    void missingConsentDoesNotDebitPatientCredit() throws Exception {
        User patient = createUser("patient.no-consent-credit@example.com");
        createPatientProfile(patient, "0901002002", 3);
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        conversation.setConsentVersion(null);
        conversation.setConsentedAt(null);
        aiConversationRepository.saveAndFlush(conversation);

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages", conversation.getId())
                .header("Idempotency-Key", "missing-consent-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Xin tu van\"}"))
            .andExpect(status().isPreconditionRequired())
            .andExpect(jsonPath("$.code").value("CHAT_CONSENT_REQUIRED"));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId())).isZero();
    }

    @Test
    @WithMockUser(username = "patient.waive-insufficient@example.com", roles = "PATIENT")
    void insufficientEvidenceAnswerWaivesInsteadOfChargingAndReplayRecordsOnce() throws Exception {
        User patient = createUser("patient.waive-insufficient@example.com");
        createPatientProfile(patient, "0901002003", 3);
        // A retrieval outage degrades the answer to INSUFFICIENT_EVIDENCE.
        when(aiService.retrieveChat(any())).thenReturn(null);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String endpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "waive-insufficient-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Benh vi co chuyen khoa nao?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false))
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("INSUFFICIENT_EVIDENCE"));

        // The degraded answer is free: the balance is untouched and the ledger
        // shows a zero-amount waiver instead of a usage charge.
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);

        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "waive-insufficient-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Benh vi co chuyen khoa nao?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(true));

        // A replayed completion short-circuits at the persisted reply, so the
        // waiver is recorded exactly once.
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId())).isEqualTo(1);
    }

    @Test
    @WithMockUser(username = "patient.zero-credit-crisis@example.com", roles = "PATIENT")
    void zeroCreditPatientSendingCrisisMessageGetsFreeEmergencyGuidance() throws Exception {
        // Audit A4 (T1): the credit gate must never stand between a patient in
        // crisis and the fixed 115 guidance. Before the fix this request died
        // at the 402 INSUFFICIENT_AI_CREDITS gate, safety text unread.
        User patient = createUser("patient.zero-credit-crisis@example.com");
        createPatientProfile(patient, "0901002014", 0);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "zero-credit-crisis-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tôi bị đau ngực dữ dội, phải làm sao\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false))
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("EMERGENCY"))
            .andExpect(jsonPath("$.assistantMessage.content").value(
                org.hamcrest.Matchers.containsString("115")));

        // The crisis answer is the canned static text: no provider call was
        // bought and no credit row was written — only the zero-amount waiver.
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);
        assertThat(ledgerBalanceAfter(patient.getId(), "AI_CHAT_WAIVED")).isZero();
    }

    @Test
    @WithMockUser(username = "patient.credited-crisis@example.com", roles = "PATIENT")
    void creditedPatientEmergencyMessageIsAnsweredWithoutAnyDeduction() throws Exception {
        // Audit A4 (T2): a paying patient receives the same free crisis answer.
        // The Tier-1 detector short-circuits before the provider, and
        // complete() waives the EMERGENCY outcome, so no credit moves.
        User patient = createUser("patient.credited-crisis@example.com");
        createPatientProfile(patient, "0901002015", 3);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "credited-crisis-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tôi khó thở dữ dội và đau ngực lan ra tay\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("EMERGENCY"))
            .andExpect(jsonPath("$.assistantMessage.content").value(
                org.hamcrest.Matchers.containsString("115")));

        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);
        assertThat(ledgerBalanceAfter(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(3);
    }

    @Test
    @WithMockUser(username = "patient.provider-safety-waived@example.com", roles = "PATIENT")
    void providerClassifiedSafetyOutcomesAreWaivedInsteadOfCharged() throws Exception {
        // Audit A4 (part 2): when the classification comes from the provider
        // (no Tier-1 acute term in the message), the completed answer is still
        // a canned safety text — REFUSE and provider-declared EMERGENCY must
        // not carry an AI_CHAT_USAGE row either.
        User patient = createUser("patient.provider-safety-waived@example.com");
        createPatientProfile(patient, "0901002016", 3);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String endpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        // @BeforeEach stubs retrieveChat → REFUSE for this content.
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "safety-waive-refuse-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi muon hoi bac si\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("REFUSE"));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);

        when(aiService.retrieveChat(any())).thenReturn(Map.of("safety_action", "EMERGENCY"));
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "safety-waive-emergency-0002")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi muon hoi them ve truoc\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("EMERGENCY"));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(2);
    }

    @Test
    void staleLeaseRecoveryRefundsAChargedAttemptOnceAndNeverRefundsUnchargedOnes() {
        // Attempt A: charged but the answer never persisted (the crash window
        // the sweep exists for). Attempt B: failed without ever being charged.
        User chargedPatient = createUser("patient.lease-refund@example.com");
        createPatientProfile(chargedPatient, "0901002004", 3);
        AiConversation chargedConversation = staleInFlightConversation(chargedPatient);
        AiMessage chargedRequest = stalePendingRequest(chargedConversation, "Cau hoi da bi tinh credit");

        User unchargedPatient = createUser("patient.lease-nocharge@example.com");
        createPatientProfile(unchargedPatient, "0901002005", 3);
        AiConversation unchargedConversation = staleInFlightConversation(unchargedPatient);
        stalePendingRequest(unchargedConversation, "Cau hoi chua bi tinh credit");

        // Seed only attempt A with the ledger charge the recovery looks for.
        jdbcTemplate.update(
            "insert into ai_credit_transactions"
                + " (user_id, target_role, amount, balance_after, transaction_type, description)"
                + " values (?, 'PATIENT', -1, 2, 'AI_CHAT_USAGE', ?)",
            chargedPatient.getId(),
            "Luot su dung Tro ly AI Y khoa [chat:" + chargedRequest.getId() + "]"
        );

        conversationService.repairStaleInFlight();

        assertThat(aiMessageRepository.findById(chargedRequest.getId()).orElseThrow().getStatus())
            .isEqualTo(AiMessageStatus.FAILED);
        assertThat(aiConversationRepository.findById(chargedConversation.getId()).orElseThrow().isInFlight())
            .isFalse();
        // Exactly one credit back, and the refund row carries the attempt marker.
        assertThat(patientProfileRepository.findByUserId(chargedPatient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(4);
        assertThat(creditTransactionCount(chargedPatient.getId(), "AI_CHAT_REFUND")).isEqualTo(1);

        // The uncharged attempt is compensated with nothing: no ledger charge
        // means no refund, so the sweep cannot mint free credits.
        assertThat(patientProfileRepository.findByUserId(unchargedPatient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(unchargedPatient.getId())).isZero();

        // A repeated sweep finds the conversation no longer in flight and the
        // refund already recorded; the ledger is unchanged.
        conversationService.repairStaleInFlight();
        assertThat(patientProfileRepository.findByUserId(chargedPatient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(4);
        assertThat(creditTransactionCount(chargedPatient.getId(), "AI_CHAT_REFUND")).isEqualTo(1);
    }

    private AiConversation staleInFlightConversation(User patient) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        AiConversation conversation = new AiConversation();
        conversation.setUser(patient);
        conversation.setTitle("Test conversation");
        conversation.setStatus(AiConversationStatus.ACTIVE);
        conversation.setInFlight(true);
        // A lease started far enough in the past to be expired by the sweep.
        conversation.setInFlightStartedAt(now.minusHours(1));
        conversation.setInFlightToken(UUID.randomUUID());
        conversation.setConsentVersion("patient-chat-v1");
        conversation.setConsentedAt(now);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(now.plusDays(90));
        return aiConversationRepository.save(conversation);
    }

    private AiMessage stalePendingRequest(AiConversation conversation, String content) {
        AiMessage message = new AiMessage();
        message.setConversation(conversation);
        message.setRole(AiMessageRole.USER);
        message.setStatus(AiMessageStatus.PENDING);
        message.setContent(content);
        message.setSequenceNumber(1);
        message.setIdempotencyKey("lease-" + UUID.randomUUID());
        message.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return aiMessageRepository.save(message);
    }

    @Test
    @WithMockUser(username = "patient.stream-enabled@example.com", roles = "PATIENT")
    void enabledStreamReturnsPersistedDeltaAndDoneEvents() throws Exception {
        User patient = createUser("patient.stream-enabled@example.com");
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages/stream", conversation.getId())
                .header("Idempotency-Key", "stream-enabled-regression")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Xin tu van\"}"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
            .andExpect(content().string(org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("event: delta\n"),
                org.hamcrest.Matchers.containsString("event: done\n"),
                org.hamcrest.Matchers.containsString("\"safetyAction\":\"REFUSE\"")
            )));
    }

    @Test
    @WithMockUser(username = "patient.stream-generate@example.com", roles = "PATIENT")
    void streamRouteUsesAiServiceStreamGenerationForAuthorizedSources() throws Exception {
        User patient = createUser("patient.stream-generate@example.com");
        createPatientProfile(patient, "0901002099", 3);
        AiConversation conversation = createConversation(
            patient,
            false,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        MedicalService service = new MedicalService();
        service.setName("Tư vấn tổng quát");
        service.setSlug("tu-van-tong-quat-" + UUID.randomUUID());
        service.setDescription("Thông tin hỗ trợ đặt lịch tư vấn tổng quát.");
        service.setActive(true);
        service = serviceRepository.saveAndFlush(service);
        String sourceId = service.getId().toString();

        when(aiService.retrieveChat(any())).thenReturn(Map.of(
            "safety_action", "ANSWER",
            "candidates", List.of(Map.of(
                "source_type", "service",
                "source_id", sourceId,
                "projection_kind", "OPERATIONAL",
                "score", 1.0
            ))
        ));
        when(aiService.generateChatStream(any(), any())).thenAnswer(invocation -> {
            AiService.ChatDeltaConsumer consumer = invocation.getArgument(1);
            consumer.accept("Bạn có thể đặt lịch tư vấn tổng quát.");
            return Map.of(
                "answer", "Bạn có thể đặt lịch tư vấn tổng quát.",
                "provenance", "local_provider",
                "used_sources", List.of(Map.of(
                    "source_type", "service",
                    "source_id", sourceId,
                    "projection_kind", "OPERATIONAL"
                ))
            );
        });

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages/stream", conversation.getId())
                .header("Idempotency-Key", "stream-generate-0001")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tôi muốn đặt lịch tư vấn\"}"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
            .andExpect(content().string(org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("event: delta\n"),
                org.hamcrest.Matchers.containsString("event: done\n"),
                org.hamcrest.Matchers.containsString("\"source_id\":\"" + sourceId + "\"")
            )));

        verify(aiService).generateChatStream(any(), any());
        verify(aiService, never()).generateChat(any());
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
    void scheduledLeaseRepairRetiresStaleExchangeWithoutUnearnedRefund() {
        // Crash-window aftermath: prepare() no longer deducts credits upon creation;
        // the sweep must retire the PENDING message without granting an unearned refund.
        User patient = createUser("patient.lease-repair@example.com");
        createPatientProfile(patient, "0901002003", 2);
        AiConversation conversation = createConversation(
            patient,
            true,
            OffsetDateTime.now(ZoneOffset.UTC).plusDays(90)
        );
        conversation.setInFlightStartedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        aiConversationRepository.saveAndFlush(conversation);

        AiMessage stale = new AiMessage();
        stale.setConversation(conversation);
        stale.setRole(AiMessageRole.USER);
        stale.setStatus(AiMessageStatus.PENDING);
        stale.setContent("Old charged question after a crash");
        stale.setSequenceNumber(1);
        stale.setIdempotencyKey("lease-repair-0001");
        stale.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(3));
        aiMessageRepository.saveAndFlush(stale);

        conversationService.repairStaleInFlight();

        assertThat(aiMessageRepository.findById(stale.getId()).orElseThrow().getStatus())
            .isEqualTo(AiMessageStatus.FAILED);
        AiConversation recovered = aiConversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(recovered.isInFlight()).isFalse();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from ai_credit_transactions where user_id = ? and transaction_type = 'AI_CHAT_REFUND'",
            Long.class,
            patient.getId()
        )).isZero();

        // A second sweep finds no stale conversation and does not alter credits.
        conversationService.repairStaleInFlight();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from ai_credit_transactions where user_id = ? and transaction_type = 'AI_CHAT_REFUND'",
            Long.class,
            patient.getId()
        )).isZero();
    }

    @Test
    @WithMockUser(username = "patient.zero-credit@example.com", roles = "PATIENT")
    void zeroCreditPatientIsRejectedAtPrepareWithoutCallingAi() throws Exception {
        User patient = createUser("patient.zero-credit@example.com");
        createPatientProfile(patient, "0901002099", 0);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "zero-credit-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi muon hoi bac si\"}"))
            .andExpect(status().isPaymentRequired())
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_AI_CREDITS"));

        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        assertThat(aiMessageRepository.findAll()).isEmpty();
    }

    @Test
    @WithMockUser(username = "patient.zero-credit-degraded@example.com", roles = "PATIENT")
    void zeroCreditPatientStillReceivesTheProviderFreeInsufficientEvidenceAnswer() throws Exception {
        User patient = createUser("patient.zero-credit-degraded@example.com");
        createPatientProfile(patient, "0901002010", 0);

        String conversationId = mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");

        String endpoint = "/api/v1/ai/conversations/" + conversationId + "/messages";
        // An explicit branch identity the live catalog cannot verify is decided
        // locally, before any provider stage: the reply cites no source, so it
        // is the degraded "I stopped rather than guess" answer and is free.
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "zero-credit-degraded-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Cơ sở số 98761 làm việc đến mấy giờ?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(false))
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.assistantMessage.citations").isEmpty());

        // Free means free on both meters: no provider work was bought and no
        // credit was spent, and the ledger still carries the audit row that
        // explains the zero-cost outcome.
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_USAGE")).isZero();
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);
        assertThat(ledgerBalanceAfter(patient.getId(), "AI_CHAT_WAIVED")).isZero();

        // Replaying the key returns the stored answer without a second audit row.
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "zero-credit-degraded-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Cơ sở số 98761 làm việc đến mấy giờ?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replayed").value(true));
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_WAIVED")).isEqualTo(1);

        // The exemption did not widen past the degraded answer: a different
        // question from the same zero-credit patient needs the paid pipeline and
        // still hits 402 at prepare, before the provider is called.
        mockMvc.perform(post(endpoint)
                .header("Idempotency-Key", "zero-credit-paid-0002")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Toi muon hoi bac si\"}"))
            .andExpect(status().isPaymentRequired())
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_AI_CREDITS"));

        // The rejected paid attempt wrote nothing: one waiver row, and the two
        // messages from the free exchange.
        assertThat(creditTransactionCount(patient.getId())).isEqualTo(1);
        assertThat(aiMessageRepository.findAll()).hasSize(2);
    }

    @Test
    void refundingTheSameAttemptMarkerTwiceCompensatesExactlyOneCredit() {
        User patient = createUser("patient.refund-idempotent@example.com");
        createPatientProfile(patient, "0901002011", 2);
        String marker = "[chat:" + UUID.randomUUID() + "]";
        // The exchange was charged once: 3 -> 2, stamped with the attempt marker.
        jdbcTemplate.update(
            "insert into ai_credit_transactions"
                + " (user_id, target_role, amount, balance_after, transaction_type, description)"
                + " values (?, 'PATIENT', -1, 2, 'AI_CHAT_USAGE', ?)",
            patient.getId(),
            "Luot su dung Tro ly AI Y khoa " + marker
        );

        assertThat(aiCreditService.refundPatientCredit(
            patient.getId(), "Hoàn credit cho lượt hỏi AI không thành công", marker)).isTrue();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        // The ledger records the post-increment balance, not the balance that
        // happened to be read before the refund ran.
        assertThat(ledgerBalanceAfter(patient.getId(), "AI_CHAT_REFUND")).isEqualTo(3);

        // The live failure path and the stale-lease sweep share this call, so
        // the same marker arriving a second time is a no-op, not a second credit.
        assertThat(aiCreditService.refundPatientCredit(
            patient.getId(), "Hoàn credit cho lượt hỏi AI không thành công", marker)).isFalse();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId(), "AI_CHAT_REFUND")).isEqualTo(1);

        // An attempt that was never charged cannot mint a credit at all.
        assertThat(aiCreditService.refundPatientCredit(
            patient.getId(),
            "Hoàn credit cho lượt hỏi AI không thành công",
            "[chat:" + UUID.randomUUID() + "]")).isFalse();
        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId())).isEqualTo(2);
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

    @Test
    void purgesConversationsOlderThanTwoWeeks() {
        User patient = createUser("patient.twoweeks@example.com");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        // 1. Old conversation (15 days ago) - should be purged
        AiConversation oldConv = createConversation(patient, false, now.plusDays(75));
        oldConv.setCreatedAt(now.minusDays(16));
        oldConv.setUpdatedAt(now.minusDays(15));
        oldConv.setLastMessageAt(now.minusDays(15));
        aiConversationRepository.save(oldConv);

        // 2. Recent conversation (5 days ago) - should NOT be purged
        AiConversation recentConv = createConversation(patient, false, now.plusDays(85));
        recentConv.setCreatedAt(now.minusDays(6));
        recentConv.setUpdatedAt(now.minusDays(5));
        recentConv.setLastMessageAt(now.minusDays(5));
        aiConversationRepository.save(recentConv);

        int deleted = conversationService.purgeConversationsOlderThanTwoWeeks();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(aiConversationRepository.findById(oldConv.getId())).isEmpty();
        assertThat(aiConversationRepository.findById(recentConv.getId())).isPresent();
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

    /** The balance the ledger last recorded for one transaction type. */
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
