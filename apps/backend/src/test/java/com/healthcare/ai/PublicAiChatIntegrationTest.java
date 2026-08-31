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
        var specialty = new com.healthcare.hospital.entity.Specialty();
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach-public-chat-test");
        specialty.setActive(true);
        specialty = specialtyRepository.saveAndFlush(specialty);

        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem chuyên khoa Tim mạch.",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", specialty.getId().toString(), "title", "provider-controlled title"
            ))
        ));

        mockMvc.perform(post("/api/v1/public/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Bệnh viện có chuyên khoa nào?\",\"recent_turns\":[]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mode").value("HOSPITAL_SUPPORT"))
            .andExpect(jsonPath("$.answer").value("Bạn có thể xem chuyên khoa Tim mạch."))
            .andExpect(jsonPath("$.citations[0].source_type").value("specialty"))
            .andExpect(jsonPath("$.citations[0].source_id").value(specialty.getId().toString()))
            .andExpect(jsonPath("$.citations[0].title").value("Tim mạch"));

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
