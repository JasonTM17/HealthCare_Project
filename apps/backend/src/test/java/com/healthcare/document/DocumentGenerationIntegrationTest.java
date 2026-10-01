package com.healthcare.document;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.document.service.DocumentObjectStore;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * F1 regression: generating an APPOINTMENT_REMINDER must survive the real
 * PostgreSQL CHECK constraint on patient_documents.source_type.
 *
 * <p>V71 defined the CHECK inline as {@code ('VISIT_SUMMARY','PRESCRIPTION')}
 * only, so Postgres auto-named it {@code patient_documents_source_type_check}
 * (verified live via pg_constraint) and every APPOINTMENT_REMINDER insert was
 * rejected with a DataIntegrityViolation that the service rethrew as a 500.
 * V109 widens that single constraint; this test drives the public endpoint
 * end-to-end against a disposable database so the whole chain (dispatch ->
 * snapshotFromAppointment -> INSERT -> object store -> AVAILABLE finalization)
 * is exercised, not just the DDL.
 */
@ActiveProfiles("test")
class DocumentGenerationIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private RoleRepository roleRepository;

    @MockitoBean private EmailSender emailSender;
    // Object-store boundary: put() succeeding is what lets the row finalize
    // to AVAILABLE (sha256 + byte_size) without a live MinIO.
    @MockitoBean private DocumentObjectStore objectStore;

    private UUID patientId;
    private UUID appointmentId;
    private String patientBearer;

    @BeforeEach
    void fixture() {
        when(emailSender.isDeliveryAvailable()).thenReturn(true);

        User patientUser = user("PATIENT");
        patientBearer = "Bearer " + tokenProvider.generateAccessToken(
                patientUser.getId(), patientUser.getEmail());

        PatientProfile patient = new PatientProfile();
        patient.setUserId(patientUser.getId());
        patient.setFullName("Synthetic reminder patient");
        patient.setPhone("0900000001");
        patient.setEmail(patientUser.getEmail());
        patient = patientProfileRepository.saveAndFlush(patient);
        patientId = patient.getId();

        Specialty specialty = new Specialty();
        specialty.setName("Synthetic specialty");
        specialty.setSlug("synthetic-" + UUID.randomUUID());
        specialty.setActive(true);
        specialty = specialtyRepository.saveAndFlush(specialty);

        Branch branch = new Branch();
        branch.setName("Synthetic branch");
        branch.setSlug("synthetic-" + UUID.randomUUID());
        branch.setAddress("Synthetic fixture only");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);

        Doctor doctor = new Doctor();
        doctor.setFullName("BS. Synthetic Reminder");
        doctor.setSlug("synthetic-" + UUID.randomUUID());
        doctor.setActive(true);
        doctor = doctorRepository.saveAndFlush(doctor);

        // appointments has a composite FK (doctor_id, branch_id) -> doctor_branches.
        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
        DoctorSpecialty doctorSpecialty = new DoctorSpecialty();
        doctorSpecialty.setDoctor(doctor);
        doctorSpecialty.setSpecialty(specialty);
        doctorSpecialtyRepository.saveAndFlush(doctorSpecialty);

        Appointment appointment = new Appointment();
        appointment.setBookingCode("REMIN-" + UUID.randomUUID().toString().substring(0, 16));
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setSpecialty(specialty);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.now().plusDays(1));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.of(
                appointment.getAppointmentDate(), appointment.getStartTime(), ZoneOffset.UTC));
        // DocumentService refuses CANCELLED / NO_SHOW sources; pick a live one.
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Synthetic appointment reminder regression");
        appointment = appointmentRepository.saveAndFlush(appointment);
        appointmentId = appointment.getId();
    }

    @Test
    void appointmentReminderGeneratesEndToEndAndFinalizesAvailable() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                // V71 CHECK without APPOINTMENT_REMINDER surfaces here as 500.
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceType").value("APPOINTMENT_REMINDER"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.sourceRecordId").value(appointmentId.toString()))
                .andReturn();

        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // The row really exists in PostgreSQL under the widened CHECK and
        // carries provenance metadata required by the status CHECK.
        var row = jdbcTemplate.queryForMap(
                "SELECT source_type, status, object_key, sha256, byte_size, idempotency_key "
                        + "FROM patient_documents WHERE id = ?", UUID.fromString(documentId));
        assertThat(row.get("source_type")).isEqualTo("APPOINTMENT_REMINDER");
        assertThat(row.get("status")).isEqualTo("AVAILABLE");
        assertThat((String) row.get("object_key")).startsWith("documents/" + patientId + "/");
        assertThat((String) row.get("sha256")).matches("^[0-9a-f]{64}$");
        assertThat(((Number) row.get("byte_size")).longValue()).isGreaterThan(0L);

        // Exactly one put for exactly this key — ADR-005 single-object rule.
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(objectStore, times(1))
                .put(eq((String) row.get("object_key")), bytes.capture(), eq("application/pdf"));
        assertThat(bytes.getValue()).isNotEmpty();
    }

    @Test
    void secondGenerationWithSameKeyReusesTheSingleRow() throws Exception {
        mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));

        // Idempotency ADR-005: the retry returns the winner row, never a
        // second document, and never touches the object store again.
        MvcResult second = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM patient_documents WHERE source_record_id = ?",
                Integer.class, appointmentId);
        assertThat(count).isEqualTo(1);
        Integer keyCount = jdbcTemplate.queryForObject(
                "SELECT count(DISTINCT idempotency_key) FROM patient_documents WHERE source_record_id = ?",
                Integer.class, appointmentId);
        assertThat(keyCount).isEqualTo(1);
        assertThat(objectMapper.readTree(second.getResponse().getContentAsString())
                .get("sourceType").asText()).isEqualTo("APPOINTMENT_REMINDER");
        verify(objectStore, times(1)).put(any(String.class), any(byte[].class), any(String.class));
    }

    private String requestBody() {
        return """
                {"sourceType":"APPOINTMENT_REMINDER","sourceRecordId":"%s"}
                """.formatted(appointmentId);
    }

    private User user(String roleCode) {
        var role = roleRepository.findByCode(roleCode).orElseThrow();
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setPasswordHash("unused-synthetic-test-hash");
        user.setDisplayName("Synthetic " + roleCode);
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);
        jdbcTemplate.update("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", user.getId(), role.getId());
        return user;
    }
}
