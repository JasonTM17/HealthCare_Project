package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "ai.chat.chunked-enabled=false")
class AiConversationStreamDisabledIntegrationTest extends AbstractIntegrationTest {

    @Test
    @WithMockUser(username = "patient.stream-disabled@example.com", roles = "PATIENT")
    void disabledStreamReturnsEmpty404InsteadOfMediaNegotiation500() throws Exception {
        User patient = createUser("patient.stream-disabled@example.com");
        createPatientProfile(patient, "0901002003", 3);

        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages/stream", UUID.randomUUID())
                .header("Idempotency-Key", "stream-disabled-regression")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Xin tu van\"}"))
            .andExpect(status().isNotFound())
            .andExpect(content().string(""));

        assertThat(patientProfileRepository.findByUserId(patient.getId()).orElseThrow().getAiCredits())
            .isEqualTo(3);
        assertThat(creditTransactionCount(patient.getId())).isZero();
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
}
