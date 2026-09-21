package com.healthcare.appointment;

import com.healthcare.appointment.dto.AdminCancelAppointmentRequest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AdminAppointmentService;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The cancellation reason an administrator records is the only reason the
 * patient is told.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code AdminAppointmentCancelTest}. Every system path that writes
 * {@code cancellation_reason} (the hold sweeper and the OTP-expiry branches of
 * {@link BookingService}) pairs it with a terminal status, and the
 * V8/V10.4/V10.5/V13 repair migrations stamp the same text on the rows they
 * cancel. A reason found on a still-live appointment therefore cannot describe
 * the cancellation being performed now, and must never be quoted to the patient
 * as if it did.
 */
class AdminAppointmentCancellationReasonTest {

    private static final UUID APPOINTMENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PATIENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID PATIENT_USER_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    /** Neutral clinic-authored copy the service substitutes when none was given. */
    private static final String NEUTRAL_REASON = "Hủy theo quyết định của cơ sở";
    /** A real principal: equality on username keeps Mockito verification unambiguous. */
    private static final UserDetails ADMIN_PRINCIPAL = new User(
        "admin@example.com", "not-used", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final ClinicalAccessAuditService auditService = mock(ClinicalAccessAuditService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AdminAppointmentService service =
        new AdminAppointmentService(appointmentRepository, auditService, notifications);

    @Test
    @DisplayName("An explicit admin reason replaces the stale system string on the row and in the copy")
    void explicitReasonReplacesStaleSystemReason() {
        Appointment appointment = liveAppointmentCarryingStaleReason();
        stubCancel(appointment);

        service.cancel(
            APPOINTMENT_ID,
            new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "Bệnh nhân gọi điện hủy giúp"),
            ADMIN_PRINCIPAL);

        assertThat(appointment.getCancellationReason()).isEqualTo("Bệnh nhân gọi điện hủy giúp");
        assertThat(notificationMessage())
            .isEqualTo("Lịch khám HC-TEST-0001 đã được cơ sở hủy. Lý do: Bệnh nhân gọi điện hủy giúp");
    }

    @Test
    @DisplayName("An omitted reason never inherits the expired-hold text left on the row")
    void omittedReasonNeverQuotesTheStaleSystemReason() {
        Appointment appointment = liveAppointmentCarryingStaleReason();
        stubCancel(appointment);

        service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, null), ADMIN_PRINCIPAL);

        // The row is rewritten, not preserved: whatever an earlier lifecycle
        // step stamped there describes a different event.
        assertThat(appointment.getCancellationReason()).isNull();
        assertThat(notificationMessage())
            .doesNotContain(BookingService.HOLD_EXPIRED_CANCELLATION_REASON)
            .isEqualTo("Lịch khám HC-TEST-0001 đã được cơ sở hủy. Lý do: " + NEUTRAL_REASON);
    }

    @Test
    @DisplayName("A blank reason normalizes to null and still quotes the neutral clinic copy")
    void blankReasonIsTreatedAsNoReason() {
        Appointment appointment = liveAppointmentCarryingStaleReason();
        appointment.setCancellationReason("Quá số lần nhập OTP không hợp lệ");
        stubCancel(appointment);

        service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "   "), ADMIN_PRINCIPAL);

        assertThat(appointment.getCancellationReason()).isNull();
        assertThat(notificationMessage()).doesNotContain("OTP").contains(NEUTRAL_REASON);
    }

    private void stubCancel(Appointment appointment) {
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(appointmentRepository.saveAndFlush(appointment)).thenReturn(appointment);
    }

    private String notificationMessage() {
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notifications).create(
            eq(PATIENT_USER_ID), eq(EventType.APPOINTMENT_CANCELLED), anyString(),
            message.capture(), eq(APPOINTMENT_ID));
        return message.getValue();
    }

    /**
     * A live booking that still carries the text the hold sweep wrote during an
     * earlier booking attempt — exactly the row shape the old
     * {@code if (reason != null)} guard leaked into the patient notification.
     */
    private Appointment liveAppointmentCarryingStaleReason() {
        PatientProfile patient = new PatientProfile();
        patient.setId(PATIENT_ID);
        patient.setUserId(PATIENT_USER_ID);
        patient.setFullName("Nguyễn Văn A");
        patient.setPhone("0900000000");
        patient.setEmail("patient@example.com");
        Doctor doctor = new Doctor();
        doctor.setId(UUID.fromString("33333333-3333-3333-3333-333333333333"));
        doctor.setFullName("Bác sĩ Trần B");
        Branch branch = new Branch();
        branch.setName("Cơ sở 1");
        branch.setAddress("12 Đường số 1, Quận 1");

        Appointment appointment = new Appointment();
        appointment.setId(APPOINTMENT_ID);
        appointment.setBookingCode("HC-TEST-0001");
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 21));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.now());
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setCancellationReason(BookingService.HOLD_EXPIRED_CANCELLATION_REASON);
        appointment.setCreatedAt(OffsetDateTime.now());
        return appointment;
    }
}
