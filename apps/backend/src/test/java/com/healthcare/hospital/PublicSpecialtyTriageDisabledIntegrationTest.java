package com.healthcare.hospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractRedisIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Feature-flag-off contract: the kill switch must reject routine triage with
 * 503, but it must never swallow an emergency — the 115 guidance runs before
 * every rejection path (audit A4/F4 ordering invariant).
 */
@Transactional
@TestPropertySource(properties = "app.public.specialty-triage.enabled=false")
class PublicSpecialtyTriageDisabledIntegrationTest extends AbstractRedisIntegrationTest {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void routineTriageIsRejectedWhenFeatureDisabled() throws Exception {
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "symptoms", "Tôi bị đau đầu kéo dài và chóng mặt"))))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
        assertThat(aiConversationRepository.count()).isZero();
    }

    @Test
    void emergencyStillReturnsGuidanceWhenFeatureDisabled() throws Exception {
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "symptoms", "đau ngực dữ dội và khó thở nặng"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.urgency_level").value("EMERGENCY"))
            .andExpect(jsonPath("$.clinical_advice").value(
                org.hamcrest.Matchers.containsString("115")))
            .andExpect(jsonPath("$.specialty_resolution").value("UNRESOLVED"));
    }

    @Test
    void overlongEmergencyStillReturnsGuidanceInsteadOfLengthRejection() throws Exception {
        // A crisis phrase buried past the 500-char limit must still win over
        // the length check — the DTO only enforces @NotBlank so the service
        // can order emergency detection ahead of every other rejection.
        String padding = "đau đầu nhẹ ".repeat(60);
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "symptoms", padding + "tôi muốn chết"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.urgency_level").value("EMERGENCY"))
            .andExpect(jsonPath("$.clinical_advice").value(
                org.hamcrest.Matchers.containsString("115")));
    }

    @Test
    void suicideCueReturnsGuidanceWhenFeatureDisabled() throws Exception {
        mockMvc.perform(post("/api/v1/public/specialty-recommendation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "symptoms", "tôi đang nghĩ đến việc tự tử"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.urgency_level").value("EMERGENCY"))
            .andExpect(jsonPath("$.clinical_advice").value(
                org.hamcrest.Matchers.containsString("115")));
    }
}
