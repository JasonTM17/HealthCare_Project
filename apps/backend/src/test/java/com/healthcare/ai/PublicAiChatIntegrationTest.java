package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.ai.service.AiService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicAiChatIntegrationTest extends AbstractIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @Test
    void unauthenticatedHospitalSupportChatIsStatelessAndBounded() throws Exception {
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem chuyên khoa Tim mạch.",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", "tim-mach", "title", "Tim mạch"
            ))
        ));

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Bệnh viện có chuyên khoa nào?\",\"recent_turns\":[]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mode").value("HOSPITAL_SUPPORT"))
            .andExpect(jsonPath("$.answer").value("Bạn có thể xem chuyên khoa Tim mạch."))
            .andExpect(jsonPath("$.citations[0].source_type").value("specialty"))
            .andExpect(jsonPath("$.citations[0].source_id").value("tim-mach"));

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

        assertThat(aiConversationRepository.count()).isZero();
        assertThat(aiMessageRepository.count()).isZero();
    }
}
