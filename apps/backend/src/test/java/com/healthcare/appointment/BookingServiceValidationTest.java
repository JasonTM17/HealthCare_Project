package com.healthcare.appointment;

import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.OtpDeliveryStatus;
import com.healthcare.appointment.dto.ResendOtpResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.appointment.service.AppointmentSlotLocker;
import com.healthcare.appointment.service.ScheduleService;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

class BookingServiceValidationTest {

    @Test
    void resendOtpRejectsDifferentPatientWithoutMutatingHold() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        Environment environment = mock(Environment.class);
        Appointment appointment = pendingAppointment(UUID.randomUUID(), UUID.randomUUID(), "0900000001");
        UUID otherUserId = UUID.randomUUID();
        com.healthcare.user.entity.User otherUser = new com.healthcare.user.entity.User();
        otherUser.setId(otherUserId);
        otherUser.setEmail("other@example.test");
        PatientProfile otherProfile = new PatientProfile();
        otherProfile.setId(UUID.randomUUID());
        otherProfile.setUserId(otherUserId);
        when(appointments.findByBookingCodeWithDetailsForUpdate("APT-OWNER")).thenReturn(Optional.of(appointment));
        when(users.findByEmail("other@example.test")).thenReturn(Optional.of(otherUser));
        when(patients.findByUserId(otherUserId)).thenReturn(Optional.of(otherProfile));

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, passwordEncoder, notifications,
            appointments::acquireSlotLock, emailSender, environment, null, null);
        UserDetails principal = new User("other@example.test", "ignored",
            List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));

        assertThatThrownBy(() -> service.resendBookingOtp("APT-OWNER", null, principal))
            .isInstanceOf(ResponseStatusException.class)
            .extracting(exception -> ((ResponseStatusException) exception).getStatusCode().value())
            .isEqualTo(404);
        verify(appointments, never()).saveAndFlush(any());
        verify(emailSender, never()).sendBookingOtp(anyString(), any(), anyString(), any(), any(), anyLong());
    }

    @Test
    void resendOtpReusesExistingHoldAndQueuesDelivery() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        Environment environment = mock(Environment.class);
        UUID ownerId = UUID.randomUUID();
        Appointment appointment = pendingAppointment(UUID.randomUUID(), ownerId, "0900000001");
        com.healthcare.user.entity.User owner = new com.healthcare.user.entity.User();
        owner.setId(ownerId);
        owner.setEmail("owner@example.test");
        owner.setStatus("ACTIVE");
        owner.setEmailVerified(true);
        PatientProfile ownerProfile = appointment.getPatient();
        ownerProfile.setEmail("owner@example.test");
        when(appointments.findByBookingCodeWithDetailsForUpdate("APT-OWNER")).thenReturn(Optional.of(appointment));
        when(users.findByEmail("owner@example.test")).thenReturn(Optional.of(owner));
        when(users.findById(ownerId)).thenReturn(Optional.of(owner));
        when(patients.findByUserId(ownerId)).thenReturn(Optional.of(ownerProfile));
        when(emailSender.isDeliveryAvailable()).thenReturn(true);
        when(emailSender.isTransactionalOutbox()).thenReturn(true);
        when(environment.getProperty("app.security.auth-otp.resend-cooldown-seconds", Long.class, 60L)).thenReturn(60L);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, passwordEncoder, notifications,
            appointments::acquireSlotLock, emailSender, environment, null, null);
        UserDetails principal = new User("owner@example.test", "ignored",
            List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));

        ResendOtpResponse response = service.resendBookingOtp("APT-OWNER", null, principal);

        assertEquals("APT-OWNER", response.bookingCode());
        assertEquals(OtpDeliveryStatus.QUEUED, response.otpDeliveryStatus());
        assertEquals(0L, response.retryAfterSeconds());
        verify(appointments).saveAndFlush(appointment);
        verify(emailSender).sendBookingOtp(anyString(), any(), anyString(), eq(ownerId), eq(appointment.getId()), eq(300L));
    }

    @Test
    void expiredOtpDoesNotCancelAStillValidHold() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        Appointment appointment = pendingAppointment(UUID.randomUUID(), UUID.randomUUID(), "0900000001");
        var originalHoldExpiry = appointment.getHoldExpiresAt();
        when(appointments.findByBookingCodeWithDetailsForUpdate("APT-OWNER"))
            .thenReturn(Optional.of(appointment));

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, notifications);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.confirmAppointment(
                new ConfirmAppointmentRequest("APT-OWNER", "123456", null)))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.OTP_EXPIRED);

        assertEquals(com.healthcare.appointment.entity.AppointmentStatus.PENDING_CONFIRMATION, appointment.getStatus());
        assertEquals(originalHoldExpiry, appointment.getHoldExpiresAt());
        verify(appointments, never()).saveAndFlush(any());
    }

    @Test
    void resendCooldownUsesServerIssuedTimestampWhenOtpExpiryIsClampedByHold() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        Environment environment = mock(Environment.class);
        UUID ownerId = UUID.randomUUID();
        Appointment appointment = pendingAppointment(UUID.randomUUID(), ownerId, "0900000001");
        appointment.setOtpIssuedAt(java.time.OffsetDateTime.now().minusSeconds(10));
        appointment.setOtpExpiresAt(java.time.OffsetDateTime.now().plusSeconds(1));
        com.healthcare.user.entity.User owner = new com.healthcare.user.entity.User();
        owner.setId(ownerId);
        owner.setEmail("owner@example.test");
        owner.setStatus("ACTIVE");
        owner.setEmailVerified(true);
        when(appointments.findByBookingCodeWithDetailsForUpdate("APT-OWNER")).thenReturn(Optional.of(appointment));
        when(users.findByEmail("owner@example.test")).thenReturn(Optional.of(owner));
        when(users.findById(ownerId)).thenReturn(Optional.of(owner));
        when(patients.findByUserId(ownerId)).thenReturn(Optional.of(appointment.getPatient()));
        when(environment.getProperty("app.security.auth-otp.resend-cooldown-seconds", Long.class, 60L)).thenReturn(60L);

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(),
            notifications, appointments::acquireSlotLock, emailSender, environment, null, null);
        UserDetails principal = new User("owner@example.test", "ignored",
            List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.resendBookingOtp("APT-OWNER", null, principal))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.OTP_RESEND_THROTTLED);
        verify(appointments, never()).saveAndFlush(any());
        verify(emailSender, never()).sendBookingOtp(anyString(), any(), anyString(), any(), any(), anyLong());
    }

    private Appointment pendingAppointment(UUID appointmentId, UUID ownerId, String phone) {
        PatientProfile patient = new PatientProfile();
        patient.setId(UUID.randomUUID());
        patient.setUserId(ownerId);
        patient.setPhone(phone);
        patient.setEmail("owner@example.test");
        Appointment appointment = new Appointment();
        appointment.setId(appointmentId);
        appointment.setBookingCode("APT-OWNER");
        appointment.setPatient(patient);
        appointment.setStatus(com.healthcare.appointment.entity.AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(java.time.OffsetDateTime.now().plusMinutes(8));
        appointment.setOtpExpiresAt(java.time.OffsetDateTime.now().minusMinutes(2));
        appointment.setOtpAttempts(0);
        return appointment;
    }

    @Test
    void rejectsHoldWithoutPrivacyConsentBeforeCatalogLookup() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, notifications);
        HoldSlotRequest request = new HoldSlotRequest(
            UUID.randomUUID(), LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", null, null, null, null, null, false, false);

        assertThatThrownBy(() -> service.holdSlot(request))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Cần đồng ý chính sách bảo mật");
    }

    @Test
    void rejectsSpecialtyThatIsNotAssignedToSelectedDoctor() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);

        UUID doctorId = UUID.randomUUID();
        UUID specialtyId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId); doctor.setActive(true);
        Specialty specialty = new Specialty(); specialty.setId(specialtyId); specialty.setActive(true);
        when(doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(specialties.findByIdAndActiveTrue(specialtyId)).thenReturn(Optional.of(specialty));
        when(doctorSpecialties.existsByDoctorIdAndSpecialtyId(doctorId, specialtyId)).thenReturn(false);

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, notifications);
        HoldSlotRequest request = new HoldSlotRequest(
            doctorId, LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", null, null, specialtyId, null, null);

        assertThatThrownBy(() -> service.holdSlot(request))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Bác sĩ không thuộc chuyên khoa");
    }

    @Test
    void reportsQueuedOtpWhenTransactionalOutboxIsActive() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        AppointmentSlotLocker slotLocker = mock(AppointmentSlotLocker.class);
        Environment environment = mock(Environment.class);
        BankTransferPaymentService paymentService = mock(BankTransferPaymentService.class);
        AppointmentClaimService claimService = mock(AppointmentClaimService.class);

        UUID doctorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        Doctor doctor = new Doctor();
        doctor.setId(doctorId);
        doctor.setActive(true);
        com.healthcare.user.entity.User authenticatedUser = new com.healthcare.user.entity.User();
        authenticatedUser.setId(userId);
        authenticatedUser.setEmail("patient@example.test");
        authenticatedUser.setStatus("ACTIVE");
        authenticatedUser.setEmailVerified(true);
        PatientProfile linkedPatient = new PatientProfile();
        linkedPatient.setId(UUID.randomUUID());
        linkedPatient.setUserId(userId);
        linkedPatient.setFullName("Bệnh nhân");
        linkedPatient.setPhone("0900000001");
        linkedPatient.setEmail("patient@example.test");
        when(doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(authenticatedUser));
        when(patients.findByUserId(userId)).thenReturn(Optional.of(linkedPatient));
        when(schedules.findBookableSlot(any(), isNull(), any(), any()))
            .thenReturn(Optional.of(new ScheduleService.BookableSlot(LocalTime.of(9, 0), LocalTime.of(9, 30))));
        when(appointments.findExpiredPendingConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        when(appointments.findActiveConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        doAnswer(invocation -> {
            Appointment appointment = invocation.getArgument(0);
            if (appointment.getId() == null) {
                appointment.setId(appointmentId);
            }
            return appointment;
        }).when(appointments).saveAndFlush(any());
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-otp");
        when(emailSender.isDeliveryAvailable()).thenReturn(true);
        when(emailSender.isTransactionalOutbox()).thenReturn(true);
        when(environment.getProperty("app.security.auth-otp.ttl-seconds", Long.class, 600L)).thenReturn(600L);
        when(environment.getProperty("app.security.auth-otp.resend-cooldown-seconds", Long.class, 60L)).thenReturn(60L);
        when(paymentService.isAvailable()).thenReturn(false);
        when(claimService.claimedUserIds(any())).thenReturn(List.of());

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, passwordEncoder, notifications, slotLocker,
            emailSender, environment, paymentService, claimService);

        org.springframework.security.core.userdetails.UserDetails userDetails =
            new User(
                "patient@example.test",
                "ignored",
                List.of(new SimpleGrantedAuthority("ROLE_PATIENT"))
            );
        HoldSlotRequest request = new HoldSlotRequest(
            doctorId, LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", null, null, null, null, null, true, true);

        assertEquals(OtpDeliveryStatus.QUEUED, service.holdSlot(request, userDetails).otpDeliveryStatus());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> variablesCaptor = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<String> recipientCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> idempotencyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<UUID> userIdCaptor = ArgumentCaptor.forClass(UUID.class);
        ArgumentCaptor<UUID> appointmentIdCaptor = ArgumentCaptor.forClass(UUID.class);
        ArgumentCaptor<Long> ttlCaptor = ArgumentCaptor.forClass(Long.class);
        verify(emailSender).sendBookingOtp(
            recipientCaptor.capture(),
            variablesCaptor.capture(),
            idempotencyCaptor.capture(),
            userIdCaptor.capture(),
            appointmentIdCaptor.capture(),
            ttlCaptor.capture()
        );
        assertEquals("patient@example.test", recipientCaptor.getValue());
        assertEquals("booking-otp-" + appointmentId, idempotencyCaptor.getValue());
        assertEquals(userId, userIdCaptor.getValue());
        assertEquals(appointmentId, appointmentIdCaptor.getValue());
        assertEquals(300L, ttlCaptor.getValue());
        assertTrue(variablesCaptor.getValue().get("code").matches("\\d{6}"));
        assertEquals("5", variablesCaptor.getValue().get("minutes"));
    }
}
