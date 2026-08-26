package com.healthcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.chat.dto.ChatContracts;
import com.healthcare.ai.chat.entity.AiConversation;
import com.healthcare.ai.chat.entity.AiConversationStatus;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.entity.ChatSafetyAction;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.ai.chat.entity.FeedbackRating;
import com.healthcare.ai.chat.service.AiConversationService;
import com.healthcare.ai.service.AiService;
import com.healthcare.ai.chat.repository.AiConversationRepository;
import com.healthcare.ai.chat.repository.AiMessageFeedbackRepository;
import com.healthcare.ai.chat.repository.AiMessageRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.user.repository.UserRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Focused regression coverage for the Spring-owned patient-chat boundary. */
class AiChatContractsTest {

    private AiService aiService;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        aiService = new AiService(new RestTemplateBuilder(), new ObjectMapper());
        ReflectionTestUtils.setField(aiService, "aiServiceUrl", "http://ai.test");
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(aiService, "restTemplate");
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    @Test
    void retrieveCarriesModeAndNeverCarriesAnAllowlist() {
        server.expect(requestTo("http://ai.test/chat/retrieve"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-AI-Service-Token", "shared-service-token"))
            .andExpect(content().json("""
                {"message":"đau đầu","mode":"SYMPTOM_TRIAGE",
                 "recent_turns":[{"role":"user","content":"xin chào"}]}
                """))
            .andRespond(withSuccess("{\"candidates\":[]}", MediaType.APPLICATION_JSON));

        Map<String, Object> response = aiService.retrieveChat(Map.of(
            "message", "  đau đầu ",
            "mode", "SYMPTOM_TRIAGE",
            "recent_history", List.of(Map.of("role", "user", "content", "xin chào")),
            "authorized_sources", List.of(Map.of("source_type", "faq"))
        ));

        assertThat(response).containsKey("candidates");
        server.verify();
    }

    @Test
    void generateCarriesExactlyTheSpringAllowlist() {
        server.expect(requestTo("http://ai.test/chat/generate"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().json("""
                {"message":"thông tin cơ sở","mode":"HOSPITAL_SUPPORT",
                 "authorized_sources":[{"source_type":"branch","source_id":"00000000-0000-0000-0000-000000000001",
                 "projection_kind":"OPERATIONAL"}]}
                """))
            .andRespond(withSuccess("{\"answer\":\"Được\",\"used_sources\":[]}", MediaType.APPLICATION_JSON));

        aiService.generateChat(Map.of(
            "message", "thông tin cơ sở",
            "mode", "HOSPITAL_SUPPORT",
            "authorized_sources", List.of(Map.of(
                "source_type", "branch",
                "source_id", "00000000-0000-0000-0000-000000000001",
                "projection_kind", "OPERATIONAL"
            ))
        ));

        server.verify();
    }

    @Test
    void messageStoresAndReloadsBoundedTriageWithoutActionsOrUrls() {
        AiMessage message = new AiMessage();
        message.setId(UUID.randomUUID());
        message.setRole(com.healthcare.ai.chat.entity.AiMessageRole.ASSISTANT);
        message.setStatus(com.healthcare.ai.chat.entity.AiMessageStatus.COMPLETED);
        message.setContent("Triage");
        message.setCreatedAt(OffsetDateTime.now());
        message.setTriage(Map.of("urgency_level", "HIGH", "recommended_specialty", "Nội thần kinh"));
        message.setSafetyAction(ChatSafetyAction.ANSWER);

        assertThat(message.getTriage())
            .containsEntry("urgency_level", "HIGH")
            .containsEntry("recommended_specialty", "Nội thần kinh");
        assertThat(new ChatContracts.TriageSummary("HIGH", "Nội thần kinh").urgencyLevel())
            .isEqualTo("HIGH");
        assertThat(ChatMode.values()).containsExactly(
            ChatMode.HOSPITAL_SUPPORT, ChatMode.SYMPTOM_TRIAGE, ChatMode.HEALTH_EDUCATION);
        assertThat(FeedbackRating.values()).containsExactly(FeedbackRating.HELPFUL, FeedbackRating.NOT_HELPFUL);
    }

    @Test
    void triageIsSymptomOnlyAndUsesAnAllowlist() {
        AiConversationService service = new AiConversationService(
            mock(AiConversationRepository.class),
            mock(AiMessageRepository.class),
            mock(AiMessageFeedbackRepository.class),
            mock(UserRepository.class),
            aiService,
            mock(com.healthcare.ai.chat.service.AiChatSourceResolver.class),
            mock(PlatformTransactionManager.class),
            90, true, 200, 20, 120);

        ChatContracts.TriageSummary parsed = ReflectionTestUtils.invokeMethod(
            service, "parseTriage",
            Map.of("urgency_level", "HIGH", "recommended_specialty", "Nội Tổng Quát"),
            ChatMode.SYMPTOM_TRIAGE);
        assertThat(parsed.urgencyLevel()).isEqualTo("HIGH");

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
            service, "parseTriage", Map.of("urgency_level", "LOW"), ChatMode.SYMPTOM_TRIAGE))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode()).isEqualTo("AI_RESPONSE_INVALID");
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
            service, "parseTriage", Map.of("urgency_level", "HIGH"), ChatMode.HOSPITAL_SUPPORT))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode()).isEqualTo("AI_RESPONSE_INVALID");
    }

    @Test
    void clinicalModesCanBeDisabledAsAReleaseRollbackSwitch() {
        AiConversationService disabled = new AiConversationService(
            mock(AiConversationRepository.class),
            mock(AiMessageRepository.class),
            mock(AiMessageFeedbackRepository.class),
            mock(UserRepository.class),
            aiService,
            mock(com.healthcare.ai.chat.service.AiChatSourceResolver.class),
            mock(PlatformTransactionManager.class),
            90, true, 200, 20, 120, false, false, false);

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
            disabled, "ensureModeEnabled", ChatMode.SYMPTOM_TRIAGE))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode())
            .isEqualTo("AI_UNAVAILABLE");
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
            disabled, "ensureModeEnabled", ChatMode.HEALTH_EDUCATION))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode())
            .isEqualTo("AI_UNAVAILABLE");
        ReflectionTestUtils.invokeMethod(disabled, "ensureModeEnabled", ChatMode.HOSPITAL_SUPPORT);

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
            disabled, "sanitize",
            Map.of("answer", "remote", "provenance", "remote_provider"),
            ChatMode.HOSPITAL_SUPPORT, List.of()))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode())
            .isEqualTo("AI_RESPONSE_INVALID");
    }

    @Test
    void groundedPatientChatCarriesOnlyDatabaseAuthorizedSyntheticAssertion() {
        AiService upstream = mock(AiService.class);
        com.healthcare.ai.chat.service.SyntheticBetaGuardService guard = mock(
            com.healthcare.ai.chat.service.SyntheticBetaGuardService.class);
        UUID userId = UUID.randomUUID();
        when(guard.eligible(userId)).thenReturn(true);
        when(upstream.retrieveChat(org.mockito.ArgumentMatchers.any()))
            .thenReturn(Map.of("safety_action", "EMERGENCY"));

        AiConversationService service = new AiConversationService(
            mock(AiConversationRepository.class),
            mock(AiMessageRepository.class),
            mock(AiMessageFeedbackRepository.class),
            mock(UserRepository.class),
            upstream,
            mock(com.healthcare.ai.chat.service.AiChatSourceResolver.class),
            mock(PlatformTransactionManager.class),
            90, true, 200, 20, 120,
            true, true, true, true, guard);

        ReflectionTestUtils.invokeMethod(
            service, "groundedResponse", userId, ChatMode.SYMPTOM_TRIAGE, "cap cuu", List.of());

        ArgumentCaptor<Map<String, Object>> request = ArgumentCaptor.forClass(Map.class);
        verify(upstream).retrieveChat(request.capture());
        assertThat(request.getValue()).containsEntry("synthetic_beta", true);
    }

    @Test
    void groundedPatientChatClearsSyntheticAssertionWhenDatabaseGuardRejectsUser() {
        AiService upstream = mock(AiService.class);
        com.healthcare.ai.chat.service.SyntheticBetaGuardService guard = mock(
            com.healthcare.ai.chat.service.SyntheticBetaGuardService.class);
        UUID userId = UUID.randomUUID();
        when(guard.eligible(userId)).thenReturn(false);
        when(upstream.retrieveChat(org.mockito.ArgumentMatchers.any()))
            .thenReturn(Map.of("safety_action", "EMERGENCY"));

        AiConversationService service = new AiConversationService(
            mock(AiConversationRepository.class),
            mock(AiMessageRepository.class),
            mock(AiMessageFeedbackRepository.class),
            mock(UserRepository.class),
            upstream,
            mock(com.healthcare.ai.chat.service.AiChatSourceResolver.class),
            mock(PlatformTransactionManager.class),
            90, true, 200, 20, 120,
            true, true, true, true, guard);

        ReflectionTestUtils.invokeMethod(
            service, "groundedResponse", userId, ChatMode.SYMPTOM_TRIAGE, "cap cuu", List.of());

        ArgumentCaptor<Map<String, Object>> request = ArgumentCaptor.forClass(Map.class);
        verify(upstream).retrieveChat(request.capture());
        assertThat(request.getValue()).containsEntry("synthetic_beta", false);
    }

    @Test
    void nullRetrievalFailsClosedWithoutLegacyProviderCall() {
        AiService upstream = mock(AiService.class);
        when(upstream.retrieveChat(org.mockito.ArgumentMatchers.any())).thenReturn(null);
        AiConversationService service = new AiConversationService(
            mock(AiConversationRepository.class),
            mock(AiMessageRepository.class),
            mock(AiMessageFeedbackRepository.class),
            mock(UserRepository.class),
            upstream,
            mock(com.healthcare.ai.chat.service.AiChatSourceResolver.class),
            mock(PlatformTransactionManager.class),
            90, true, 200, 20, 120);

        Object response = ReflectionTestUtils.invokeMethod(
            service, "groundedResponse", UUID.randomUUID(), ChatMode.HOSPITAL_SUPPORT,
            "thong tin chi nhanh", List.of());

        Object safetyAction = ReflectionTestUtils.invokeMethod(response, "safetyAction");
        assertThat((Object) safetyAction)
            .isEqualTo(ChatSafetyAction.INSUFFICIENT_EVIDENCE);
        verify(upstream, never()).chat(org.mockito.ArgumentMatchers.any());
        verify(upstream).retrieveChat(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void finalPersistenceValidationDowngradesAnswerWhenClinicalSourceDrifts() {
        AiConversationRepository conversations = mock(AiConversationRepository.class);
        AiMessageRepository messages = mock(AiMessageRepository.class);
        AiMessageFeedbackRepository feedback = mock(AiMessageFeedbackRepository.class);
        UserRepository users = mock(UserRepository.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        AiConversationService service = new AiConversationService(
            conversations,
            messages,
            feedback,
            users,
            mock(AiService.class),
            resolver,
            transactionManager,
            90, true, 200, 20, 120);

        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID userMessageId = UUID.randomUUID();
        UUID processingToken = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        AiConversation conversation = new AiConversation();
        conversation.setId(conversationId);
        conversation.setTitle("Test conversation");
        conversation.setStatus(AiConversationStatus.ACTIVE);
        conversation.setInFlight(true);
        conversation.setInFlightStartedAt(now);
        conversation.setInFlightToken(processingToken);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(now.plusDays(90));

        AiMessage request = new AiMessage();
        request.setId(userMessageId);
        request.setConversation(conversation);
        request.setRole(AiMessageRole.USER);
        request.setStatus(AiMessageStatus.PENDING);
        request.setContent("Dấu hiệu bệnh tim");
        request.setSequenceNumber(1);
        request.setCreatedAt(now);

        String contentHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        AiChatSourceResolver.ResolvedSource source = new AiChatSourceResolver.ResolvedSource(
            "article", sourceId.toString(), "Dấu hiệu bệnh tim", "dau-hieu-benh-tim",
            true, true, "CLINICAL", 1L, 2L, contentHash, "3",
            "/articles/dau-hieu-benh-tim", null);

        when(conversations.findOwnedForUpdate(conversationId, userId)).thenReturn(java.util.Optional.of(conversation));
        when(messages.findById(userMessageId)).thenReturn(java.util.Optional.of(request));
        when(messages.findByRequestMessageId(userMessageId)).thenReturn(java.util.Optional.empty());
        when(messages.findMaxSequence(conversationId)).thenReturn(1L);
        when(messages.save(org.mockito.ArgumentMatchers.any(AiMessage.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(conversations.save(org.mockito.ArgumentMatchers.any(AiConversation.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(feedback.findById(org.mockito.ArgumentMatchers.any())).thenReturn(java.util.Optional.empty());
        when(resolver.revalidate(ChatMode.HEALTH_EDUCATION, "article", sourceId.toString()))
            .thenReturn(source);
        when(resolver.citations(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(
            Map.of("source_type", "article", "source_id", sourceId.toString(),
                "title", "Dấu hiệu bệnh tim", "projection_kind", "CLINICAL",
                "content_revision", "1", "eligibility_revision", "2",
                "content_hash", contentHash, "approval_id", "3")));
        when(resolver.actions(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", "Dấu hiệu bệnh tim",
                "href", "/articles/dau-hieu-benh-tim")));
        // Simulate a revoke/edit committed after sanitize but before complete.
        when(resolver.revalidateForPersistence(
                org.mockito.ArgumentMatchers.eq(ChatMode.HEALTH_EDUCATION),
                org.mockito.ArgumentMatchers.any())).thenReturn(List.of());

        Object sanitized = ReflectionTestUtils.invokeMethod(
            service,
            "sanitize",
            Map.of(
                "answer", "Câu trả lời cũ không được phép lưu",
                "provenance", "local_provider",
                "safety_action", "ANSWER",
                "used_sources", List.of(Map.of(
                    "source_type", "article", "source_id", sourceId.toString(),
                    "projection_kind", "CLINICAL", "content_revision", 1,
                    "eligibility_revision", 2, "content_hash", contentHash,
                    "approval_id", "3"))),
            ChatMode.HEALTH_EDUCATION,
            List.of(source));

        ReflectionTestUtils.invokeMethod(
            service,
            "complete",
            userId,
            conversationId,
            userMessageId,
            processingToken,
            sanitized,
            ChatMode.HEALTH_EDUCATION);

        org.mockito.ArgumentCaptor<AiMessage> saved = org.mockito.ArgumentCaptor.forClass(AiMessage.class);
        verify(messages, atLeastOnce()).save(saved.capture());
        AiMessage assistant = saved.getAllValues().stream()
            .filter(message -> message.getRole() == AiMessageRole.ASSISTANT)
            .findFirst()
            .orElseThrow();
        assertThat(assistant.getSafetyAction()).isEqualTo(ChatSafetyAction.INSUFFICIENT_EVIDENCE);
        assertThat(assistant.getContent()).contains("chưa tìm thấy nguồn");
        assertThat(assistant.getContent()).doesNotContain("Câu trả lời cũ");
        assertThat(assistant.getCitations()).isEmpty();
        verify(resolver).revalidateForPersistence(
            org.mockito.ArgumentMatchers.eq(ChatMode.HEALTH_EDUCATION),
            org.mockito.ArgumentMatchers.any());
    }
}
