package com.healthcare.careplan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class CarePlanIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private EntityManager entityManager;

    @Test
    void doctorCanManageCarePlanLifecycleAndNotifyTheOtherParty() throws Exception {
        Fixture fixture = fixture();
        String createBody = """
            {
              "appointmentId": "%s",
              "title": "Theo dõi sau khám",
              "items": [
                {
                  "goal": "Đo huyết áp buổi sáng",
                  "reminder": "Ghi kết quả vào nhật ký",
                  "dueAt": "2026-09-10T00:00:00+07:00"
                }
              ]
            }
            """.formatted(fixture.appointment().getId());

        String createdBody = mockMvc.perform(post("/api/v1/doctor/care-plans")
                .header("Authorization", bearer(fixture.doctorUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Theo dõi sau khám"))
            .andExpect(jsonPath("$.items.length()").value(1))
            .andReturn().getResponse().getContentAsString();
        JsonNode created = objectMapper.readTree(createdBody);
        UUID planId = UUID.fromString(created.get("id").asText());
        UUID firstItemId = UUID.fromString(created.get("items").get(0).get("id").asText());
        assertNotification(fixture.patientUser().getId(), "CARE_PLAN_CREATED", planId, 1);

        String updateBody = """
            {
              "title": "Theo dõi phục hồi tại nhà",
              "items": [
                {
                  "id": "%s",
                  "goal": "Đo huyết áp sáng và tối",
                  "reminder": "Ghi số đo trước khi ngủ",
                  "dueAt": "2026-09-11T00:00:00+07:00"
                },
                {
                  "goal": "Đi bộ nhẹ 15 phút",
                  "reminder": "Dừng lại nếu khó thở",
                  "dueAt": "2026-09-12T00:00:00+07:00"
                }
              ]
            }
            """.formatted(firstItemId);
        String updatedBody = mockMvc.perform(put("/api/v1/doctor/care-plans/{planId}", planId)
                .header("Authorization", bearer(fixture.doctorUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Theo dõi phục hồi tại nhà"))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].goal").value("Đo huyết áp sáng và tối"))
            .andReturn().getResponse().getContentAsString();
        JsonNode updated = objectMapper.readTree(updatedBody);
        UUID secondItemId = UUID.fromString(updated.get("items").get(1).get("id").asText());
        assertPatientCanSeeOpenItem(fixture.patientUser().getId(), firstItemId);

        mockMvc.perform(post("/api/v1/patient/care-plans/items/{itemId}/complete", firstItemId)
                .header("Authorization", bearer(fixture.patientUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DONE"));
        assertNotification(fixture.doctorUser().getId(), "CARE_PLAN_ITEM_COMPLETED", firstItemId, 1);

        mockMvc.perform(post("/api/v1/doctor/care-plans/items/{itemId}/cancel", secondItemId)
                .header("Authorization", bearer(fixture.doctorUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertNotification(fixture.patientUser().getId(), "CARE_PLAN_ITEM_CANCELLED", secondItemId, 1);

        mockMvc.perform(get("/api/v1/patient/care-plans")
                .header("Authorization", bearer(fixture.patientUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].status").value("DONE"))
            .andExpect(jsonPath("$[0].items[0].status").value("DONE"))
            .andExpect(jsonPath("$[0].items[1].status").value("CANCELLED"));

        mockMvc.perform(delete("/api/v1/doctor/care-plans/{planId}", planId)
                .header("Authorization", bearer(fixture.doctorUser())))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/patient/care-plans")
                .header("Authorization", bearer(fixture.patientUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    private Fixture fixture() {
        User patientUser = user("PATIENT", "care.patient." + UUID.randomUUID() + "@healthcare.local");
        User doctorUser = user("DOCTOR", "care.doctor." + UUID.randomUUID() + "@healthcare.local");

        PatientProfile patient = new PatientProfile();
        patient.setFullName("Care Plan Patient");
        patient.setPhone("09" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        patient.setEmail(patientUser.getEmail());
        patient.setUserId(patientUser.getId());
        patient = patientProfileRepository.saveAndFlush(patient);

        Doctor doctor = new Doctor();
        doctor.setFullName("Bác sĩ Care Plan");
        doctor.setSlug("care-plan-" + UUID.randomUUID());
        doctor.setActive(true);
        doctor.setUserId(doctorUser.getId());
        doctor = doctorRepository.saveAndFlush(doctor);

        Appointment appointment = new Appointment();
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 15));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.parse("2026-09-15T09:00:00+07:00"));
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment = appointmentRepository.saveAndFlush(appointment);

        return new Fixture(patientUser, doctorUser, appointment);
    }

    private User user(String roleCode, String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName(roleCode + " CarePlan");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        return userRepository.saveAndFlush(user);
    }

    private String bearer(User user) {
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private void assertNotification(UUID userId, String eventType, UUID referenceId, int expected) {
        entityManager.flush();
        Integer count = jdbcTemplate.queryForObject("""
            SELECT count(*) FROM notifications
             WHERE user_id = ? AND event_type = ? AND reference_id = ?
            """, Integer.class, userId, eventType, referenceId);
        assertThat(count).isEqualTo(expected);
    }

    private void assertPatientCanSeeOpenItem(UUID userId, UUID itemId) {
        Integer count = jdbcTemplate.queryForObject("""
            SELECT count(*)
              FROM patient_care_plan_items i
              JOIN patient_care_plans p ON p.id = i.care_plan_id
              JOIN patient_profiles pp ON pp.id = i.patient_profile_id
             WHERE i.id = ? AND pp.user_id = ?
               AND i.status = 'OPEN' AND p.status = 'OPEN'
               AND i.deleted_at IS NULL AND p.deleted_at IS NULL
               AND i.retention_expires_at > CURRENT_TIMESTAMP
               AND p.retention_expires_at > CURRENT_TIMESTAMP
            """, Integer.class, itemId, userId);
        assertThat(count).isEqualTo(1);
    }

    private record Fixture(User patientUser, User doctorUser, Appointment appointment) {}
}
