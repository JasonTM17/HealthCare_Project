package com.healthcare.consultation;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class ConsultationAdminPaginationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void adminConsultationQueueDefaultsToTwentyItemArrayAndSupportsPageSizeParams() throws Exception {
        String bearer = bearer("ADMIN");
        UUID patientUserId = createUserWithRole("PATIENT").getId();
        UUID patientProfileId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        jdbcTemplate.update("""
            INSERT INTO patient_profiles(id, user_id, full_name, phone, email)
            VALUES (?, ?, 'Consultation Patient', ?, 'consultation.patient@example.test')
            """, patientProfileId, patientUserId, "+84000000101");
        jdbcTemplate.update("""
            INSERT INTO doctors(id, full_name, slug, active)
            VALUES (?, 'Consultation Doctor', ?, true)
            """, doctorId, "consultation-doctor-" + UUID.randomUUID());

        for (int index = 0; index < 25; index++) {
            UUID appointmentId = UUID.randomUUID();
            jdbcTemplate.update("""
                INSERT INTO appointments(
                    id, booking_code, patient_id, doctor_id, appointment_date, start_time,
                    end_time, appointment_time, status, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '1 day', 'CONFIRMED', 'PAID')
                """, appointmentId, "B" + index + UUID.randomUUID().toString().substring(0, 8),
                patientProfileId, doctorId, LocalDate.now().plusDays(1L + index),
                LocalTime.of(9, 0), LocalTime.of(9, 30));
            jdbcTemplate.update("""
                INSERT INTO patient_consultation_threads(
                    appointment_id, patient_profile_id, doctor_id, status, subject,
                    consent_version, consented_at, consultation_open_until, retention_expires_at,
                    created_at, updated_at)
                VALUES (?, ?, ?, 'OPEN', ?, 'consultation-v1', CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days',
                        CURRENT_TIMESTAMP - (? * INTERVAL '1 minute'),
                        CURRENT_TIMESTAMP - (? * INTERVAL '1 minute'))
                """, appointmentId, patientProfileId, doctorId, "Thread " + index, index, index);
        }

        mockMvc.perform(get("/api/v1/admin/consultations/queue").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page", "0"))
            .andExpect(header().string("X-Page-Size", "20"))
            .andExpect(header().string("X-Has-More", "true"))
            .andExpect(jsonPath("$.length()").value(20));

        mockMvc.perform(get("/api/v1/admin/consultations/queue?page=1&size=10").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page", "1"))
            .andExpect(header().string("X-Page-Size", "10"))
            .andExpect(header().string("X-Has-More", "true"))
            .andExpect(jsonPath("$.length()").value(10));

        mockMvc.perform(get("/api/v1/admin/consultations/queue?page=0&size=1000").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Page-Size", "100"));
    }

    private User createUserWithRole(String roleCode) {
        User user = new User();
        user.setEmail("consultation." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Consultation Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        return userRepository.saveAndFlush(user);
    }

    private String bearer(String roleCode) {
        User user = createUserWithRole(roleCode);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }
}
