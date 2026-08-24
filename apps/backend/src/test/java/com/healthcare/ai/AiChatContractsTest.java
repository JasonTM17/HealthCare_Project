package com.healthcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.chat.dto.ChatContracts;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.entity.ChatSafetyAction;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
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
}
