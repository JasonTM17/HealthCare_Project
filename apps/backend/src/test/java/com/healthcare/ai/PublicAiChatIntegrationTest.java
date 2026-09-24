package com.healthcare.ai;

import com.healthcare.AbstractRedisIntegrationTest;
import com.healthcare.ai.chat.service.ChatRequestCancellation;
import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import com.healthcare.ai.service.AiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicAiChatIntegrationTest extends AbstractRedisIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @Autowired
    private ChatRequestCancellationRegistry cancellations;

    @BeforeEach
    void delegateCancellablePublicChatToTheConfiguredProviderStub() {
        when(aiService.chat(anyMap(), any(ChatRequestCancellation.class)))
            .thenAnswer(invocation -> aiService.chat(invocation.getArgument(0)));
    }

    @Test
    void guestChatCancellationReachesTheBlockedAiServiceCall() throws Exception {
        String requestId = UUID.randomUUID().toString();
        CountDownLatch providerStarted = new CountDownLatch(1);
        CountDownLatch providerCancelled = new CountDownLatch(1);
        when(aiService.chat(any(), any(ChatRequestCancellation.class))).thenAnswer(invocation -> {
            ChatRequestCancellation cancellation = invocation.getArgument(1);
            cancellation.onCancel(providerCancelled::countDown);
            providerStarted.countDown();
            if (!providerCancelled.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Cancellation did not reach the blocked guest provider stage");
            }
            throw new CancellationException("Synthetic blocked provider stopped");
        });

        CompletableFuture<org.springframework.test.web.servlet.MvcResult> request =
            CompletableFuture.supplyAsync(() -> {
                try {
                    return mockMvc.perform(post("/api/v1/public/ai/chat")
                            .header("X-Request-ID", requestId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"message\":\"Bệnh viện có chuyên khoa nào?\"}"))
                        .andReturn();
                } catch (Exception exception) {
                    throw new CompletionException(exception);
                }
            });

        assertThat(providerStarted.await(5, TimeUnit.SECONDS)).isTrue();
        cancellations.cancel(requestId);

        org.springframework.test.web.servlet.MvcResult response = request.get(5, TimeUnit.SECONDS);
        assertThat(response.getResponse().getStatus()).isEqualTo(503);
        assertThat(providerCancelled.await(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void unauthenticatedHospitalSupportChatIsStatelessAndBounded() throws Exception {
        String requestId = "123e4567-e89b-42d3-a456-426614174000";
        var specialty = new com.healthcare.hospital.entity.Specialty();
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach-public-chat-test");
        specialty.setActive(true);
        specialty = specialtyRepository.saveAndFlush(specialty);

        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem chuyên khoa Tim mạch.",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", specialty.getId().toString(), "title", "provider-controlled title"
            ))
        ));

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .header("X-Request-ID", requestId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Bệnh viện có chuyên khoa nào?\",\"recent_turns\":[]}"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Request-ID", requestId))
            .andExpect(jsonPath("$.mode").value("HOSPITAL_SUPPORT"))
            .andExpect(jsonPath("$.answer").value("Bạn có thể xem chuyên khoa Tim mạch."))
            .andExpect(jsonPath("$.citations[0].source_type").value("specialty"))
            .andExpect(jsonPath("$.citations[0].source_id").value(specialty.getId().toString()))
            .andExpect(jsonPath("$.citations[0].title").value("Tim mạch"));

        assertThat(aiConversationRepository.count()).isZero();
        assertThat(aiMessageRepository.count()).isZero();
    }

    @Test
    void inactiveCatalogCitationRejectsTheEntirePublicAnswer() throws Exception {
        var specialty = new com.healthcare.hospital.entity.Specialty();
        specialty.setName("Chuyên khoa tạm ngưng");
        specialty.setSlug("inactive-public-chat-" + java.util.UUID.randomUUID());
        specialty.setActive(false);
        specialty = specialtyRepository.saveAndFlush(specialty);

        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem chuyên khoa tạm ngưng.",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty",
                "source_id", specialty.getId().toString(),
                "title", "Chuyên khoa tạm ngưng"
            ))
        ));

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Bệnh viện có chuyên khoa nào?\"}"))
            .andExpect(status().isBadGateway());

        assertThat(aiConversationRepository.count()).isZero();
        assertThat(aiMessageRepository.count()).isZero();
    }

    @Test
    void ungroundedPreparationAnswerReturnsSafePublicResponse() throws Exception {
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn phải nhịn ăn 12 giờ trước buổi khám tổng quát.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Cần chuẩn bị gì trước buổi khám tổng quát tại HealthCare?\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.safety_action").value("INSUFFICIENT_EVIDENCE"))
            .andExpect(jsonPath("$.provenance").value("local_fallback"))
            .andExpect(jsonPath("$.routingReason").value("public_missing_verified_source"))
            .andExpect(jsonPath("$.citations").isEmpty())
            .andExpect(jsonPath("$.suggested_actions").isArray());

        assertThat(aiConversationRepository.count()).isZero();
        assertThat(aiMessageRepository.count()).isZero();
    }

    @Test
    void publicHospitalSupportChatRejectsModeAndOversizedContent() throws Exception {
        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Xin chào\",\"mode\":\"SYMPTOM_TRIAGE\"}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"" + "x".repeat(501) + "\"}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Xin" + ((char) 1) + "chào\"}"))
            .andExpect(status().isBadRequest());

        assertThat(aiConversationRepository.count()).isZero();
        assertThat(aiMessageRepository.count()).isZero();
    }
}
