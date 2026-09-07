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
    @Autowired private com.healthcare.scheduling.service.DoctorScheduleService scheduleService;
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"create", "update", "delete"})
    void concurrentOverlappingCreatesSerializeUntilCommit(String firstOperation) throws Exception {
        Doctor doctor = assignedDoctor();
        Branch branch = assignedBranch(doctor);
        UUID doctorId = doctor.getId();
        UUID branchId = branch.getId();
        UUID existingId = firstOperation.equals("create") ? null : scheduleService.createSchedule(doctorId, branchId,
            new DoctorScheduleRequest(2, LocalTime.of(13, 0), LocalTime.of(17, 0), 30,
                LocalDate.of(2030, 1, 1), null, true)).getId();
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        var request = new DoctorScheduleRequest(2, LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
            LocalDate.of(2030, 1, 1), null, true);
        var firstWritten = new java.util.concurrent.CountDownLatch(1);
        var releaseFirst = new java.util.concurrent.CountDownLatch(1);
        var secondStarted = new java.util.concurrent.CountDownLatch(1);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .executeWithoutResult(tx -> {
                    switch (firstOperation) {
                        case "update" -> scheduleService.updateSchedule(existingId, request);
                        case "delete" -> scheduleService.deleteSchedule(existingId);
                        default -> scheduleService.createSchedule(doctorId, branchId, request);
                    }
                    firstWritten.countDown();
                    try {
                        if (!releaseFirst.await(15, java.util.concurrent.TimeUnit.SECONDS))
                            throw new AssertionError("First schedule transaction was not released");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new AssertionError(e);
                    }
                }));
            org.assertj.core.api.Assertions.assertThat(firstWritten.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            String applicationName = "schedule-race-" + UUID.randomUUID();
            var second = executor.submit(() -> {
                try {
                    new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                        jdbcTemplate.queryForObject("select set_config('application_name', ?, true)", String.class, applicationName);
                        secondStarted.countDown();
                        if (firstOperation.equals("delete")) scheduleService.updateSchedule(existingId, request);
                        else scheduleService.createSchedule(doctorId, branchId, request);
                    });
                    return 200;
                } catch (com.healthcare.exception.BusinessException e) {
                    return e.getStatus();
                }
            });
            org.assertj.core.api.Assertions.assertThat(secondStarted.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(10);
            boolean blocked = false;
            while (System.nanoTime() < deadline && !second.isDone()) {
                blocked = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "select exists(select 1 from pg_stat_activity where application_name = ? and wait_event_type = 'Lock')",
                    Boolean.class, applicationName));
                if (blocked) break;
                Thread.sleep(20);
            }
            org.assertj.core.api.Assertions.assertThat(blocked).as("Second create waits for first transaction's doctor lock").isTrue();
            releaseFirst.countDown();
            first.get(10, java.util.concurrent.TimeUnit.SECONDS);
            org.assertj.core.api.Assertions.assertThat(second.get(10, java.util.concurrent.TimeUnit.SECONDS))
                .isEqualTo(firstOperation.equals("delete") ? 404 : 409);
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select count(*) from doctor_schedules where doctor_id = ? and branch_id = ?",
                Integer.class, doctorId, branchId)).isEqualTo(firstOperation.equals("delete") ? 0 : 1);
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
            org.assertj.core.api.Assertions.assertThat(executor.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        }
    }

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
