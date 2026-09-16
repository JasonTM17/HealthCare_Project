package com.healthcare.healthqa;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class HealthQuestionAdminPaginationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void adminHealthQuestionQueueDefaultsToTwentyItemArrayAndSupportsPageSizeParams() throws Exception {
        String bearer = bearer("ADMIN");
        UUID patientUserId = createUserWithRole("PATIENT").getId();
        UUID patientProfileId = UUID.randomUUID();
        jdbcTemplate.update("""
            INSERT INTO patient_profiles(id, user_id, full_name, phone, email)
            VALUES (?, ?, 'Question Patient', ?, 'question.patient@example.test')
            """, patientProfileId, patientUserId, "+84000000001");
        for (int index = 0; index < 25; index++) {
            jdbcTemplate.update("""
                INSERT INTO health_questions(
                    patient_profile_id, author_user_id, topic_slug, normalized_question,
                    public_alias, pii_scan_status, pii_scanned_at, status, created_at, retention_expires_at)
                VALUES (?, ?, 'tim-mach', ?, ?, 'CLEAR', CURRENT_TIMESTAMP,
                        'PENDING_MODERATION', CURRENT_TIMESTAMP - (? * INTERVAL '1 minute'),
                        CURRENT_TIMESTAMP + INTERVAL '30 days')
                """, patientProfileId, patientUserId, "Question " + index, "alias" + index, index);
        }

        mockMvc.perform(get("/api/v1/admin/health-questions").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page", "0"))
            .andExpect(header().string("X-Page-Size", "20"))
            .andExpect(header().string("X-Has-More", "true"))
            .andExpect(jsonPath("$.length()").value(20));

        mockMvc.perform(get("/api/v1/admin/health-questions?page=1&size=10").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page", "1"))
            .andExpect(header().string("X-Page-Size", "10"))
            .andExpect(header().string("X-Has-More", "true"))
            .andExpect(jsonPath("$.length()").value(10));

        mockMvc.perform(get("/api/v1/admin/health-questions?page=0&size=1000").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page-Size", "100"));
    }

    private User createUserWithRole(String roleCode) {
        User user = new User();
        user.setEmail("health-question." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Health Question Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        return userRepository.saveAndFlush(user);
    }

    private String bearer(String roleCode) {
        User user = createUserWithRole(roleCode);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }
}
