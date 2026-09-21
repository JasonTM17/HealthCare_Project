package com.healthcare.clinical;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.dto.CreateMedicalRecordRequest;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.repository.DiagnosticOrderRepository;
import com.healthcare.clinical.repository.DiagnosticResultRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.storage.repository.StoredFileRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plan outcome: the patient learns that the visit is over and the record is in
 * the portal.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code AdminAppointmentCancelTest}: the whole {@code createMedicalRecord}
 * transaction is replayed against mocked repositories and the assertion is the
 * recipient, event type and copy of the notification the completion writes.
 */
class ClinicalVisitCompletedNotificationTest {

    private static final UUID PATIENT_USER_ID = UUID.fromString("12121212-1111-1111-1111-111111111111");
    private static final UUID PATIENT_PROFILE_ID = UUID.fromString("13131313-2222-2222-2222-222222222222");
    private static final UUID DOCTOR_ID = UUID.fromString("14141414-3333-3333-3333-333333333333");
    private static final UUID APPOINTMENT_ID = UUID.fromString("15151515-4444-4444-4444-444444444444");
    private static final String DIAGNOSIS = "Tăng huyết áp độ 1";

    private final MedicalRecordRepository medicalRecordRepository = mock(MedicalRecordRepository.class);
    private final PatientProfileRepository patientProfileRepository = mock(PatientProfileRepository.class);
    private final DoctorRepository doctorRepository = mock(DoctorRepository.class);
    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final ClinicalService service = new ClinicalService(
        medicalRecordRepository,
        mock(PrescriptionRepository.class),
        mock(DiagnosticResultRepository.class),
        mock(DiagnosticOrderRepository.class),
        patientProfileRepository,
        doctorRepository,
        appointmentRepository,
        userRepository,
        mock(StoredFileRepository.class),
        notifications,
        mock(ClinicalAccessAuditService.class));

    private UserDetails doctorPrincipal;

    @BeforeEach
    void wireOwnedAppointment() {
        doctorPrincipal = new org.springframework.security.core.userdetails.User(
            "doctor@example.test", "not-used", List.of(new SimpleGrantedAuthority("ROLE_DOCTOR")));

        User doctorUser = new User();
        doctorUser.setId(UUID.fromString("16161616-5555-5555-5555-555555555555"));
        when(userRepository.findByEmail("doctor@example.test")).thenReturn(Optional.of(doctorUser));

        PatientProfile patient = new PatientProfile();
        patient.setId(PATIENT_PROFILE_ID);
        patient.setUserId(PATIENT_USER_ID);
        patient.setFullName("Nguyễn Văn A");
        patient.setPhone("0900000000");
        when(patientProfileRepository.findById(PATIENT_PROFILE_ID)).thenReturn(Optional.of(patient));

        Doctor doctor = new Doctor();
        doctor.setId(DOCTOR_ID);
        doctor.setUserId(doctorUser.getId());
        doctor.setFullName("Bác sĩ Trần B");
        when(doctorRepository.findById(DOCTOR_ID)).thenReturn(Optional.of(doctor));
        when(doctorRepository.findByUserId(doctorUser.getId())).thenReturn(Optional.of(doctor));

        Appointment appointment = new Appointment();
        appointment.setId(APPOINTMENT_ID);
        appointment.setBookingCode("HC-TEST-0001");
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setStatus(AppointmentStatus.IN_PROGRESS);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(medicalRecordRepository.findByAppointmentId(APPOINTMENT_ID)).thenReturn(Optional.empty());
        when(medicalRecordRepository.saveAndFlush(any(MedicalRecord.class)))
            .thenAnswer(call -> call.getArgument(0));
    }

    @Test
    @DisplayName("Completing the visit notifies the patient with VISIT_COMPLETED")
    void visitCompletionNotifiesPatient() {
        service.createMedicalRecord(request(), doctorPrincipal);

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notifications).create(
            eq(PATIENT_USER_ID), eq(EventType.VISIT_COMPLETED), eq("Khám bệnh đã hoàn tất"),
            message.capture(), any());
        assertThat(message.getValue()).contains("đã được lưu vào hồ sơ của bạn");
    }

    @Test
    @DisplayName("The completion notice never carries diagnosis text")
    void completionNoticeStaysFreeOfClinicalNarrative() {
        service.createMedicalRecord(request(), doctorPrincipal);

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notifications).create(
            eq(PATIENT_USER_ID), eq(EventType.VISIT_COMPLETED), anyString(), message.capture(), any());
        assertThat(message.getValue()).doesNotContain(DIAGNOSIS);
    }

    private CreateMedicalRecordRequest request() {
        return new CreateMedicalRecordRequest(
            APPOINTMENT_ID, PATIENT_PROFILE_ID, DOCTOR_ID,
            "I10", "Tăng huyết áp nguyên phát", DIAGNOSIS, "Đau đầu vùng chẩm",
            132, 86, 78, null, null, null,
            "Hẹn khám lại sau 4 tuần", null, null, null, null);
    }
}
