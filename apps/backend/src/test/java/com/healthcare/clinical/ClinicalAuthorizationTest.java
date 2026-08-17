package com.healthcare.clinical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.clinical.dto.CreateMedicalRecordRequest;
import com.healthcare.clinical.dto.PrescriptionItemDto;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.entity.Prescription;
import com.healthcare.clinical.entity.PrescriptionItem;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Transactional
class ClinicalAuthorizationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private DoctorRepository doctorRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void unauthenticatedClinicalReadIsRejected() throws Exception {
        ClinicalFixture fixture = fixture();
        MedicalRecord record = createRecord(fixture, true);

        mockMvc.perform(get("/api/v1/clinical/records/{id}", record.getId()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void patientCannotReadAnotherPatientsRecordOrHistory() throws Exception {
        ClinicalFixture fixture = fixture();
        MedicalRecord record = createRecord(fixture, true);

        mockMvc.perform(get("/api/v1/clinical/records/{id}", record.getId())
                .header("Authorization", bearer(fixture.otherPatientUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/clinical/patients/{patientId}/records", fixture.patient().getId())
                .header("Authorization", bearer(fixture.otherPatientUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/clinical/records/{id}", record.getId())
                .header("Authorization", bearer(fixture.patientUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.patientId").value(fixture.patient().getId().toString()))
            .andExpect(jsonPath("$.prescriptions[0].medicalRecord").doesNotExist());
    }

    @Test
    void doctorCannotReadAnotherDoctorsRecordOrPatientPortalData() throws Exception {
        ClinicalFixture fixture = fixture();
        MedicalRecord record = createRecord(fixture, true);

        mockMvc.perform(get("/api/v1/clinical/records/{id}", record.getId())
                .header("Authorization", bearer(fixture.otherDoctorUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/doctor/patients/{patientId}/medical-records", fixture.patient().getId())
                .header("Authorization", bearer(fixture.otherDoctorUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/doctor/patients/{patientId}/medical-records", fixture.patient().getId())
                .header("Authorization", bearer(fixture.doctorUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].doctorId").value(fixture.doctor().getId().toString()));
    }

    @Test
    void prescriptionIsVisibleOnlyToOwningPatientAssignedDoctorOrAdmin() throws Exception {
        ClinicalFixture fixture = fixture();
        MedicalRecord record = createRecord(fixture, true);
        String code = record.getPrescriptions().get(0).getPrescriptionCode();

        mockMvc.perform(get("/api/v1/clinical/prescriptions/{code}", code)
                .header("Authorization", bearer(fixture.otherPatientUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/clinical/prescriptions/{code}", code)
                .header("Authorization", bearer(fixture.otherDoctorUser())))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/clinical/prescriptions/{code}", code)
                .header("Authorization", bearer(fixture.patientUser())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.prescriptionCode").value(code))
            .andExpect(jsonPath("$.items[0].prescription").doesNotExist());

        mockMvc.perform(get("/api/v1/clinical/prescriptions/{code}", code)
                .header("Authorization", bearer(fixture.adminUser())))
            .andExpect(status().isOk());
    }

    @Test
    void linkedDoctorCanCreateRecordAndCompleteItsAppointment() throws Exception {
        ClinicalFixture fixture = fixture();
        Appointment appointment = createAppointment(fixture);
        CreateMedicalRecordRequest request = new CreateMedicalRecordRequest(
            appointment.getId(),
            fixture.patient().getId(),
            fixture.doctor().getId(),
            "J06.9",
            "Acute upper respiratory infection",
            "Acute respiratory infection",
            "Cough and fever",
            120, 80, 76,
            new BigDecimal("36.8"),
            new BigDecimal("65.00"),
            new BigDecimal("170.00"),
            "Rest and fluids",
            "Follow up if symptoms worsen",
            LocalDate.now().plusDays(7),
            List.of(new PrescriptionItemDto(
                "Paracetamol", "Acetaminophen", "500", "mg",
                "Every 8 hours", 5, 15, "After meals")),
            "Take medicine after meals");

        mockMvc.perform(post("/api/v1/clinical/records")
                .header("Authorization", bearer(fixture.doctorUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.patientId").value(fixture.patient().getId().toString()))
            .andExpect(jsonPath("$.doctorId").value(fixture.doctor().getId().toString()))
            .andExpect(jsonPath("$.prescriptions[0].items[0].medicationName").value("Paracetamol"))
            .andExpect(jsonPath("$.prescriptions[0].items[0].prescription").doesNotExist());

        assertThat(appointmentRepository.findById(appointment.getId()))
            .get()
            .extracting(Appointment::getStatus)
            .isEqualTo(AppointmentStatus.COMPLETED);
    }

    @Test
    void patientCannotCreateClinicalRecord() throws Exception {
        ClinicalFixture fixture = fixture();
        Appointment appointment = createAppointment(fixture);
        String body = objectMapper.writeValueAsString(new CreateMedicalRecordRequest(
            appointment.getId(), fixture.patient().getId(), fixture.doctor().getId(),
            null, null, "Patient supplied diagnosis", null,
            null, null, null, null, null, null, null, null, null, null, null));

        mockMvc.perform(post("/api/v1/clinical/records")
                .header("Authorization", bearer(fixture.patientUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());
    }

    @Test
    void invalidNestedPrescriptionItemIsRejected() throws Exception {
        ClinicalFixture fixture = fixture();
        Appointment appointment = createAppointment(fixture);
        String body = """
            {
              "appointmentId": "%s",
              "patientId": "%s",
              "doctorId": "%s",
              "diagnosis": "Diagnosis",
              "prescriptionItems": [{
                "medicationName": "",
                "dosage": "",
                "frequency": "",
                "durationDays": 0,
                "totalQuantity": 0
              }]
            }
            """.formatted(appointment.getId(), fixture.patient().getId(), fixture.doctor().getId());

        mockMvc.perform(post("/api/v1/clinical/records")
                .header("Authorization", bearer(fixture.doctorUser()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private ClinicalFixture fixture() {
        Role patientRole = roleRepository.findByCode("PATIENT").orElseThrow();
        Role doctorRole = roleRepository.findByCode("DOCTOR").orElseThrow();
        Role adminRole = roleRepository.findByCode("ADMIN").orElseThrow();

        User patientUser = createUser(patientRole, "clinical.patient." + UUID.randomUUID() + "@example.com");
        User otherPatientUser = createUser(patientRole, "clinical.other.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser(doctorRole, "clinical.doctor." + UUID.randomUUID() + "@example.com");
        User otherDoctorUser = createUser(doctorRole, "clinical.other.doctor." + UUID.randomUUID() + "@example.com");
        User adminUser = createUser(adminRole, "clinical.admin." + UUID.randomUUID() + "@example.com");

        PatientProfile patient = createPatient(patientUser, "090" + randomDigits());
        PatientProfile otherPatient = createPatient(otherPatientUser, "091" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "clinical-doctor-" + UUID.randomUUID());
        Doctor otherDoctor = createDoctor(otherDoctorUser, "clinical-other-doctor-" + UUID.randomUUID());

        return new ClinicalFixture(
            patientUser, otherPatientUser, doctorUser, otherDoctorUser, adminUser,
            patient, otherPatient, doctor, otherDoctor);
    }

    private User createUser(Role role, String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName(role.getCode() + " Clinical Test");
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

    private Appointment createAppointment(ClinicalFixture fixture) {
        LocalDate date = LocalDate.now().plusDays(2);
        LocalTime start = LocalTime.of(9, 0);
        Appointment appointment = new Appointment();
        appointment.setBookingCode("CLIN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        appointment.setPatient(fixture.patient());
        appointment.setDoctor(fixture.doctor());
        appointment.setAppointmentDate(date);
        appointment.setStartTime(start);
        appointment.setEndTime(start.plusMinutes(30));
        appointment.setAppointmentTime(OffsetDateTime.of(date, start, OffsetDateTime.now().getOffset()));
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Clinical test visit");
        return appointmentRepository.saveAndFlush(appointment);
    }

    private MedicalRecord createRecord(ClinicalFixture fixture, boolean withPrescription) {
        Appointment appointment = createAppointment(fixture);
        MedicalRecord record = new MedicalRecord();
        record.setAppointment(appointment);
        record.setPatient(fixture.patient());
        record.setDoctor(fixture.doctor());
        record.setDiagnosis("Fixture diagnosis");
        record.setSymptomsSummary("Fixture symptoms");

        if (withPrescription) {
            Prescription prescription = new Prescription();
            prescription.setMedicalRecord(record);
            prescription.setPatient(fixture.patient());
            prescription.setDoctor(fixture.doctor());
            prescription.setPrescriptionCode("RX-TEST-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
            prescription.setDiagnosisSummary("Fixture diagnosis");
            prescription.setGeneralAdvice("Fixture advice");
            prescription.setStatus("ACTIVE");

            PrescriptionItem item = new PrescriptionItem();
            item.setMedicationName("Fixture medicine");
            item.setDosage("500");
            item.setUnit("mg");
            item.setFrequency("Once daily");
            item.setDurationDays(5);
            item.setTotalQuantity(5);
            prescription.addItem(item);
            record.getPrescriptions().add(prescription);
        }
        return medicalRecordRepository.saveAndFlush(record);
    }

    private String bearer(User user) {
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private String randomDigits() {
        return String.valueOf(Math.abs(UUID.randomUUID().getLeastSignificantBits())).substring(0, 7);
    }

    private record ClinicalFixture(
        User patientUser,
        User otherPatientUser,
        User doctorUser,
        User otherDoctorUser,
        User adminUser,
        PatientProfile patient,
        PatientProfile otherPatient,
        Doctor doctor,
        Doctor otherDoctor) {
    }
}
