package com.healthcare.appointment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Transactional
class AppointmentPortalIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate PORTAL_DATE = LocalDate.of(2030, 1, 15);

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void patientAppointmentsAreScopedPaginatedAndDoNotExposeSecrets() throws Exception {
        User patientUser = createUser("PATIENT", "portal.patient." + UUID.randomUUID() + "@example.com");
        User otherPatientUser = createUser("PATIENT", "portal.other.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "090" + randomDigits());
        PatientProfile otherPatient = createPatient(otherPatientUser, "091" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);

        Appointment first = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            patient, doctor, branch, PORTAL_DATE.plusDays(1), LocalTime.of(10, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            otherPatient, doctor, branch, PORTAL_DATE, LocalTime.of(11, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(get("/api/v1/patient/appointments")
                .param("page", "0")
                .param("size", "1")
                .param("sort", "appointmentDate,asc")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].id").value(first.getId().toString()))
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.content[0].doctorName").value(doctor.getFullName()))
            .andExpect(jsonPath("$.content[0].branchId").value(branch.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientPhone").doesNotExist())
            .andExpect(jsonPath("$.content[0].patientEmail").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpCode").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpExpiresAt").doesNotExist());
    }

    @Test
    void patientCanReadAndUpdateOwnProfileWithoutChangingIdentityFields() throws Exception {
        User patientUser = createUser("PATIENT", "portal.profile.patient." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "097" + randomDigits());

        mockMvc.perform(put("/api/v1/patient/profile")
                .header("Authorization", bearer(patientUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName": "Nguyen Van Updated",
                      "dateOfBirth": "1990-05-20",
                      "gender": "MALE",
                      "address": "Ho Chi Minh City",
                      "emergencyContactName": "Emergency Contact",
                      "emergencyContactPhone": "0901234567"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(patient.getId().toString()))
            .andExpect(jsonPath("$.fullName").value("Nguyen Van Updated"))
            .andExpect(jsonPath("$.phone").value(patient.getPhone()))
            .andExpect(jsonPath("$.gender").value("MALE"));

        mockMvc.perform(get("/api/v1/patient/profile")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value("Ho Chi Minh City"));
    }

    @Test
    void doctorAppointmentsAreScopedByDoctorDateAndStatus() throws Exception {
        User patientUser = createUser("PATIENT", "portal.doctor.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.doctor.owner." + UUID.randomUUID() + "@example.com");
        User otherDoctorUser = createUser("DOCTOR", "portal.doctor.other." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "092" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-owner-doctor-" + UUID.randomUUID());
        Doctor otherDoctor = createDoctor(otherDoctorUser, "portal-other-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-doctor-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        assignDoctorToBranch(otherDoctor, branch);

        Appointment confirmed = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(10, 0), AppointmentStatus.CANCELLED);
        createAppointment(
            patient, otherDoctor, branch, PORTAL_DATE, LocalTime.of(11, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .param("status", "CONFIRMED")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].id").value(confirmed.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientId").value(patient.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientName").value(patient.getFullName()))
            .andExpect(jsonPath("$.content[0].patientPhone").doesNotExist())
            .andExpect(jsonPath("$.content[0].patientEmail").doesNotExist())
            .andExpect(jsonPath("$.content[0].paymentStatus").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpCode").doesNotExist());
    }

    @Test
    void wrongRolesAndInvalidDoctorFiltersAreRejected() throws Exception {
        User patientUser = createUser("PATIENT", "portal.invalid.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.invalid.doctor." + UUID.randomUUID() + "@example.com");
        createPatient(patientUser, "093" + randomDigits());
        createDoctor(doctorUser, "portal-invalid-doctor-" + UUID.randomUUID());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/patient/appointments")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", "2030-99-15")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .param("status", "NOT_A_STATUS")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void doctorEmptyPageReportsNoRows() throws Exception {
        User doctorUser = createUser("DOCTOR", "portal.empty.doctor." + UUID.randomUUID() + "@example.com");
        createDoctor(doctorUser, "portal-empty-doctor-" + UUID.randomUUID());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(0))
            .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void assignedDoctorCanAdvanceAppointmentLifecycleInOrder() throws Exception {
        User patientUser = createUser("PATIENT", "portal.workflow.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.workflow.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "094" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-workflow-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-workflow-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now(), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CHECKED_IN\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CHECKED_IN"));

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void doctorCannotSkipLifecycleOrUpdateAnotherDoctorsAppointment() throws Exception {
        User patientUser = createUser("PATIENT", "portal.workflow.guard.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.workflow.guard.doctor." + UUID.randomUUID() + "@example.com");
        User otherDoctorUser = createUser("DOCTOR", "portal.workflow.guard.other." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "095" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-workflow-guard-" + UUID.randomUUID());
        createDoctor(otherDoctorUser, "portal-workflow-other-" + UUID.randomUUID());
        Branch branch = createBranch("portal-workflow-guard-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now(), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}"))
            .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(otherDoctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CHECKED_IN\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void doctorCanMarkPastConfirmedAppointmentAsNoShow() throws Exception {
        User patientUser = createUser("PATIENT", "portal.noshow.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.noshow.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "096" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-noshow-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-noshow-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now().minusDays(1), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"NO_SHOW\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("NO_SHOW"));
    }

    private User createUser(String roleCode, String email) {
        Role role = roleRepository.findByCode(roleCode).orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName(roleCode + " Portal Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(role);
        return userRepository.saveAndFlush(user);
    }

    private PatientProfile createPatient(User user, String phone) {
        PatientProfile patient = new PatientProfile();
        patient.setUserId(user.getId());
        patient.setFullName(user.getDisplayName());
        patient.setPhone(phone);
        patient.setEmail(user.getEmail());
        return patientProfileRepository.saveAndFlush(patient);
    }

    private Doctor createDoctor(User user, String slug) {
        Doctor doctor = new Doctor();
        doctor.setUserId(user.getId());
        doctor.setFullName(user.getDisplayName());
        doctor.setSlug(slug);
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private Branch createBranch(String slug) {
        Branch branch = new Branch();
        branch.setName("Portal branch");
        branch.setSlug(slug);
        branch.setAddress("Portal test address");
        branch.setActive(true);
        return branchRepository.saveAndFlush(branch);
    }

    private void assignDoctorToBranch(Doctor doctor, Branch branch) {
        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
    }

    private Appointment createAppointment(
            PatientProfile patient,
            Doctor doctor,
            Branch branch,
            LocalDate date,
            LocalTime start,
            AppointmentStatus status) {
        Appointment appointment = new Appointment();
        appointment.setBookingCode("PORTAL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(date);
        appointment.setStartTime(start);
        appointment.setEndTime(start.plusMinutes(30));
        appointment.setAppointmentTime(OffsetDateTime.of(date, start, ZoneOffset.UTC));
        appointment.setStatus(status);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Portal appointment test");
        appointment.setOtpCode("123456");
        appointment.setOtpExpiresAt(OffsetDateTime.now().plusMinutes(10));
        return appointmentRepository.saveAndFlush(appointment);
    }

    private String bearer(User user) {
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private String randomDigits() {
        return String.valueOf(Math.abs(UUID.randomUUID().getLeastSignificantBits())).substring(0, 7);
    }
}
