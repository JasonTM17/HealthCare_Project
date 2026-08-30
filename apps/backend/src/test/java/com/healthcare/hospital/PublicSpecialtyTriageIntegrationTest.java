package com.healthcare.hospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.entity.Specialty;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class PublicSpecialtyTriageIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void unauthenticatedTriageResolvesSqlSpecialtyAndDoesNotCreateChat() throws Exception {
        Specialty neurology = new Specialty();
        neurology.setName("Thần kinh");
        neurology.setSlug("than-kinh");
        neurology.setDescription("Khám đau đầu");
        neurology.setActive(true);
        neurology.setCommonSymptoms(JsonNodeFactory.instance.arrayNode().add("Đau đầu kéo dài").add("Chóng mặt"));
        neurology = specialtyRepository.saveAndFlush(neurology);

        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("symptoms", "Tôi bị đau đầu kéo dài và chóng mặt"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.specialty_resolution").value("RESOLVED"))
            .andExpect(jsonPath("$.recommended_specialty_id").value(neurology.getId().toString()))
            .andExpect(jsonPath("$.recommended_specialty").value("Thần kinh"))
            .andExpect(jsonPath("$.citations[0].source_type").value("specialty"));

        assertThat(aiConversationRepository.count()).isZero();
    }

    @Test
    void unauthenticatedAiSpecialtyRecommendationStaysUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/ai/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("symptoms", "đau đầu chóng mặt"))))
            .andExpect(status().isUnauthorized());
        assertThat(aiConversationRepository.count()).isZero();
    }

    @Test
    void diagnoseAndPrescribeCopyIsBlocked() throws Exception {
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("symptoms", "kê đơn kháng sinh giúp tôi"))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("CHAT_CONTENT_BLOCKED"));
        assertThat(aiConversationRepository.count()).isZero();
    }

    @Test
    void emergencySymptomsDoNotResolveABookableSpecialty() throws Exception {
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("symptoms", "đau ngực dữ dội và khó thở nặng"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.urgency_level").value("EMERGENCY"))
            .andExpect(jsonPath("$.specialty_resolution").value("UNRESOLVED"))
            .andExpect(jsonPath("$.recommended_specialty_id").doesNotExist());
    }
}
