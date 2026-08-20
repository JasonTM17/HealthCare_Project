package com.healthcare.scheduling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class AdminScheduleIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void adminCanListSchedulesAndAnonymousCannot() throws Exception {
        mockMvc.perform(get("/api/v1/admin/schedules"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/schedules")
                .header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void invalidDayIsRejectedByScheduleDto() throws Exception {
        mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}", UUID.randomUUID(), UUID.randomUUID())
                .header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new DoctorScheduleRequest(0, LocalTime.of(9, 0), LocalTime.of(10, 0), 30,
                    LocalDate.now(), null, true))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalidTimeRangeIsRejectedByScheduleDto() throws Exception {
        mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}", UUID.randomUUID(), UUID.randomUUID())
                .header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new DoctorScheduleRequest(1, LocalTime.of(11, 0), LocalTime.of(10, 0), 30,
                    LocalDate.now(), null, true))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalidDurationIsRejectedByScheduleDto() throws Exception {
        mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}", UUID.randomUUID(), UUID.randomUUID())
                .header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new DoctorScheduleRequest(1, LocalTime.of(9, 0), LocalTime.of(10, 0), 0,
                    LocalDate.now(), null, true))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalidEffectiveRangeIsRejectedByScheduleDto() throws Exception {
        mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}", UUID.randomUUID(), UUID.randomUUID())
                .header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new DoctorScheduleRequest(1, LocalTime.of(9, 0), LocalTime.of(10, 0), 30,
                    LocalDate.now().plusDays(2), LocalDate.now(), true))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void scheduleCreationRequiresDoctorBranchRelation() throws Exception {
        Doctor doctor = new Doctor();
        doctor.setFullName("Unassigned schedule doctor");
        doctor.setSlug("unassigned-schedule-doctor-" + UUID.randomUUID());
        doctor.setActive(true);
        doctor = doctorRepository.saveAndFlush(doctor);

        Branch branch = new Branch();
        branch.setName("Unassigned schedule branch");
        branch.setSlug("unassigned-schedule-branch-" + UUID.randomUUID());
        branch.setAddress("Test address");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);

        DoctorScheduleRequest request = new DoctorScheduleRequest(
            1, LocalTime.of(9, 0), LocalTime.of(10, 0), 30, LocalDate.now(), null, true);
        mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}", doctor.getId(), branch.getId())
                .header("Authorization", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createAndUpdateReturnFlatScheduleResponseContract() throws Exception {
        String adminBearer = adminToken();
        Doctor doctor = assignedDoctor();
        Branch branch = assignedBranch(doctor);
        DoctorScheduleRequest createRequest = new DoctorScheduleRequest(
            2, LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
            LocalDate.of(2026, 9, 1), null, true);

        String body = mockMvc.perform(post("/api/v1/admin/schedules/doctors/{doctorId}/branches/{branchId}",
                    doctor.getId(), branch.getId())
                .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(createRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.doctorId").value(doctor.getId().toString()))
            .andExpect(jsonPath("$.doctorName").value(doctor.getFullName()))
            .andExpect(jsonPath("$.branchId").value(branch.getId().toString()))
            .andExpect(jsonPath("$.branchName").value(branch.getName()))
            .andExpect(jsonPath("$.doctor").doesNotExist())
            .andExpect(jsonPath("$.branch").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();

        UUID scheduleId = UUID.fromString(objectMapper.readTree(body).path("id").asText());
        DoctorScheduleRequest updateRequest = new DoctorScheduleRequest(
            2, LocalTime.of(13, 0), LocalTime.of(17, 0), 20,
            LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 31), false);

        mockMvc.perform(put("/api/v1/admin/schedules/{scheduleId}", scheduleId)
                .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(updateRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(scheduleId.toString()))
            .andExpect(jsonPath("$.doctorId").value(doctor.getId().toString()))
            .andExpect(jsonPath("$.branchId").value(branch.getId().toString()))
            .andExpect(jsonPath("$.startTime").value("13:00:00"))
            .andExpect(jsonPath("$.endTime").value("17:00:00"))
            .andExpect(jsonPath("$.slotDurationMinutes").value(20))
            .andExpect(jsonPath("$.effectiveTo").value("2026-12-31"))
            .andExpect(jsonPath("$.active").value(false))
            .andExpect(jsonPath("$.doctor").doesNotExist())
            .andExpect(jsonPath("$.branch").doesNotExist());
    }

    private String json(DoctorScheduleRequest request) throws Exception {
        return objectMapper.writeValueAsString(request);
    }

    private Doctor assignedDoctor() {
        Doctor doctor = new Doctor();
        doctor.setFullName("Assigned schedule doctor " + UUID.randomUUID());
        doctor.setSlug("assigned-schedule-doctor-" + UUID.randomUUID());
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private Branch assignedBranch(Doctor doctor) {
        Branch branch = new Branch();
        branch.setName("Assigned schedule branch " + UUID.randomUUID());
        branch.setSlug("assigned-schedule-branch-" + UUID.randomUUID());
        branch.setAddress("Test address");
        branch.setActive(false);
        branch = branchRepository.saveAndFlush(branch);

        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
        return branch;
    }

    private String adminToken() {
        User user = new User();
        user.setEmail("schedule.admin." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Schedule Admin");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode("ADMIN").orElseThrow());
        user = userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }
}
