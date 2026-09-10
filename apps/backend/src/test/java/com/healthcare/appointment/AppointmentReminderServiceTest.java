package com.healthcare.appointment;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.appointment.service.AppointmentReminderService;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentReminderServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private AppointmentClaimService appointmentClaimService;

    private AppointmentReminderService reminderService;

    @BeforeEach
    void setUp() {
        reminderService = new AppointmentReminderService(
            appointmentRepository,
            notificationService,
            appointmentClaimService
        );
    }

    @Test
    void sendsReminderToDirectPatientUser() {
        UUID directUserId = UUID.randomUUID();
        PatientProfile patient = new PatientProfile();
        patient.setUserId(directUserId);

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("BK-DIRECT-1");
        appointment.setPatient(patient);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 15));
        appointment.setStartTime(LocalTime.of(9, 0));

        when(appointmentRepository.lockDueReminders(any(OffsetDateTime.class), any(OffsetDateTime.class)))
            .thenReturn(List.of(appointment));

        int sent = reminderService.sendDueReminders();

        assertThat(sent).isEqualTo(1);
        assertThat(appointment.getReminderSentAt()).isNotNull();
        verify(notificationService).create(
            eq(directUserId),
            eq(EventType.APPOINTMENT_REMINDER),
            eq("Nhắc lịch khám sắp tới"),
            eq("Bạn có lịch khám BK-DIRECT-1 vào 2026-09-15 lúc 09:00."),
            eq(appointment.getId())
        );
    }

    @Test
    void sendsReminderToClaimedUserWhenPatientUserIdIsNull() {
        UUID claimedUserId = UUID.randomUUID();
        PatientProfile patient = new PatientProfile();
        patient.setUserId(null); // Guest patient

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("BK-CLAIMED-1");
        appointment.setPatient(patient);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 15));
        appointment.setStartTime(LocalTime.of(14, 30));

        when(appointmentRepository.lockDueReminders(any(OffsetDateTime.class), any(OffsetDateTime.class)))
            .thenReturn(List.of(appointment));
        when(appointmentClaimService.claimedUserIds(appointment.getId()))
            .thenReturn(List.of(claimedUserId));

        int sent = reminderService.sendDueReminders();

        assertThat(sent).isEqualTo(1);
        assertThat(appointment.getReminderSentAt()).isNotNull();
        verify(notificationService).create(
            eq(claimedUserId),
            eq(EventType.APPOINTMENT_REMINDER),
            eq("Nhắc lịch khám sắp tới"),
            eq("Bạn có lịch khám BK-CLAIMED-1 vào 2026-09-15 lúc 14:30."),
            eq(appointment.getId())
        );
    }

    @Test
    void skipsNotificationWhenNeitherDirectNorClaimedUserExists() {
        PatientProfile patient = new PatientProfile();
        patient.setUserId(null);

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("BK-ANONYMOUS-1");
        appointment.setPatient(patient);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 15));
        appointment.setStartTime(LocalTime.of(10, 0));

        when(appointmentRepository.lockDueReminders(any(OffsetDateTime.class), any(OffsetDateTime.class)))
            .thenReturn(List.of(appointment));
        when(appointmentClaimService.claimedUserIds(appointment.getId()))
            .thenReturn(List.of());

        int sent = reminderService.sendDueReminders();

        assertThat(sent).isEqualTo(1);
        assertThat(appointment.getReminderSentAt()).isNotNull();
        verifyNoInteractions(notificationService);
    }
}
