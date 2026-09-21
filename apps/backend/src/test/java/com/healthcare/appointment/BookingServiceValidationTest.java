package com.healthcare.appointment;

import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
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
import static org.mockito.Mockito.verifyNoInteractions;

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

    @Test
    void confirmNotifiesTheAssignedDoctorAboutTheNewBooking() {
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

        UUID doctorUserId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        Doctor doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setUserId(doctorUserId);
        doctor.setFullName("Bác sĩ Trần B");
        PatientProfile patient = new PatientProfile();
        patient.setId(UUID.randomUUID());
        patient.setUserId(patientUserId);
        patient.setFullName("Nguyễn Văn A");
        patient.setPhone("0900000001");
        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("APT-DOCTOR");
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setStatus(com.healthcare.appointment.entity.AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(java.time.OffsetDateTime.now().plusMinutes(8));
        appointment.setOtpExpiresAt(java.time.OffsetDateTime.now().plusMinutes(4));
        appointment.setOtpCode("$2a$10$encoded");
        appointment.setOtpAttempts(0);
        when(appointments.findByBookingCodeWithDetailsForUpdate("APT-DOCTOR"))
            .thenReturn(Optional.of(appointment));
        when(appointments.saveAndFlush(any())).thenReturn(appointment);
        when(passwordEncoder.matches(eq("123456"), eq("$2a$10$encoded"))).thenReturn(true);

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, passwordEncoder, notifications,
            appointments::acquireSlotLock,
            new AfterCommitEmailSender(new com.healthcare.auth.mail.NoopEmailSender()),
            null, null, null);

        service.confirmAppointment(new ConfirmAppointmentRequest("APT-DOCTOR", "123456", null));

        // The assigned physician gets one heads-up carrying the slot and the
        // patient display name — never diagnosis content — and the patient
        // keeps the pre-existing confirmation notice.
        verify(notifications).create(
            eq(doctorUserId),
            eq(com.healthcare.notification.entity.Notification.EventType.APPOINTMENT_CONFIRMED),
            anyString(),
            org.mockito.ArgumentMatchers.contains("APT-DOCTOR"),
            eq(appointment.getId()));
        verify(notifications).create(
            eq(patientUserId),
            eq(com.healthcare.notification.entity.Notification.EventType.APPOINTMENT_CONFIRMED),
            anyString(),
            anyString(),
            eq(appointment.getId()));
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
        // Branch is mandatory for every hold now; the specialty rule must still
        // be the check that fires for a doctor who does not own the specialty.
        HoldSlotRequest request = new HoldSlotRequest(
            doctorId, LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", null, null, specialtyId, UUID.randomUUID(), null);

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
        UUID branchId = UUID.randomUUID();
        Doctor doctor = new Doctor();
        doctor.setId(doctorId);
        doctor.setActive(true);
        com.healthcare.hospital.entity.Branch branch = new com.healthcare.hospital.entity.Branch();
        branch.setId(branchId);
        branch.setActive(true);
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
        when(branches.findByIdAndActiveTrue(branchId)).thenReturn(Optional.of(branch));
        when(doctorBranches.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(schedules.findBookableSlot(any(), eq(branchId), any(), any()))
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
            "Bệnh nhân", "0900000001", null, null, null, branchId, null, true, true);

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

    /** Fully wired BookingService for the hold-path tests below. */
    private static final class HoldFixture {
        final AppointmentRepository appointments = mock(AppointmentRepository.class);
        final PatientProfileRepository patients = mock(PatientProfileRepository.class);
        final DoctorRepository doctors = mock(DoctorRepository.class);
        final DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        final DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        final SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        final BranchRepository branches = mock(BranchRepository.class);
        final PackageRepository packages = mock(PackageRepository.class);
        final UserRepository users = mock(UserRepository.class);
        final ScheduleService schedules = mock(ScheduleService.class);
        final NotificationService notifications = mock(NotificationService.class);
        final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        final AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        final Environment environment = mock(Environment.class);
        final AppointmentSlotLocker slotLocker = mock(AppointmentSlotLocker.class);
        final BankTransferPaymentService payments = mock(BankTransferPaymentService.class);
        final AppointmentClaimService claimService = mock(AppointmentClaimService.class);

        BookingService service() {
            return new BookingService(
                appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
                branches, packages, users, schedules, passwordEncoder, notifications, slotLocker,
                emailSender, environment, payments, claimService);
        }
    }

    private static com.healthcare.hospital.entity.Branch activeBranch(UUID branchId) {
        com.healthcare.hospital.entity.Branch branch = new com.healthcare.hospital.entity.Branch();
        branch.setId(branchId);
        branch.setActive(true);
        return branch;
    }

    private static Doctor activeDoctor(UUID doctorId) {
        Doctor doctor = new Doctor();
        doctor.setId(doctorId);
        doctor.setActive(true);
        return doctor;
    }

    private static HoldSlotRequest holdRequest(UUID doctorId, UUID branchId) {
        return new HoldSlotRequest(
            doctorId, LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", "patient@example.test", null, null, branchId, null, false, true);
    }

    @Test
    void rejectsHoldWithoutBranchBeforeAnyCatalogOrAvailabilityWork() {
        HoldFixture fixture = new HoldFixture();
        BookingService service = fixture.service();
        HoldSlotRequest request = new HoldSlotRequest(
            UUID.randomUUID(), LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", "patient@example.test", null, null, null, null, false, true);

        // A branchless hold would bypass the V10 composite (doctor, branch) FK,
        // so it is rejected before any catalog or schedule lookup runs.
        assertThatThrownBy(() -> service.holdSlot(request))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.BRANCH_REQUIRED);
        verify(fixture.doctors, never()).findById(any());
        verifyNoInteractions(fixture.schedules);
    }

    @Test
    void rejectsDoctorOverlapInAnotherBranchWhenTheRequestedBranchIsFree() {
        HoldFixture fixture = new HoldFixture();
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        LocalDate date = LocalDate.now().plusDays(1);
        Doctor doctor = activeDoctor(doctorId);

        when(fixture.doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(fixture.branches.findByIdAndActiveTrue(branchId)).thenReturn(Optional.of(activeBranch(branchId)));
        when(fixture.doctorBranches.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(fixture.schedules.findBookableSlot(eq(doctorId), eq(branchId), eq(date), eq(LocalTime.of(9, 0))))
            .thenReturn(Optional.of(new ScheduleService.BookableSlot(LocalTime.of(9, 0), LocalTime.of(9, 30))));
        when(fixture.appointments.findExpiredPendingConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        when(fixture.appointments.findActiveConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        Appointment bookedElsewhere = new Appointment();
        bookedElsewhere.setId(UUID.randomUUID());
        when(fixture.appointments.findDoctorOverlapsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of(bookedElsewhere));

        BookingService service = fixture.service();

        // The branch-scoped exclusion constraint cannot see the other branch; the
        // doctor-level guard is what stops a cross-branch double booking.
        assertThatThrownBy(() -> service.holdSlot(holdRequest(doctorId, branchId), null, null))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("cơ sở khác");
        verify(fixture.appointments, never()).saveAndFlush(any());
        verifyNoInteractions(fixture.emailSender);
    }

    @Test
    void capLiveHoldsPerPatientRejectsTheThirdHold() {
        HoldFixture fixture = new HoldFixture();
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDate date = LocalDate.now().plusDays(1);
        Doctor doctor = activeDoctor(doctorId);

        com.healthcare.user.entity.User user = new com.healthcare.user.entity.User();
        user.setId(userId);
        user.setEmail("patient@example.test");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        PatientProfile linked = new PatientProfile();
        linked.setId(UUID.randomUUID());
        linked.setUserId(userId);
        linked.setFullName("Bệnh nhân");
        linked.setPhone("0900000001");
        linked.setEmail("patient@example.test");

        when(fixture.doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(fixture.branches.findByIdAndActiveTrue(branchId)).thenReturn(Optional.of(activeBranch(branchId)));
        when(fixture.doctorBranches.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(fixture.schedules.findBookableSlot(eq(doctorId), eq(branchId), eq(date), eq(LocalTime.of(9, 0))))
            .thenReturn(Optional.of(new ScheduleService.BookableSlot(LocalTime.of(9, 0), LocalTime.of(9, 30))));
        when(fixture.appointments.findExpiredPendingConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        when(fixture.appointments.findActiveConflictsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        when(fixture.appointments.findDoctorOverlapsForUpdate(any(), any(), any(), any(), any(), any()))
            .thenReturn(List.of());
        when(fixture.users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(fixture.patients.findByUserId(userId)).thenReturn(Optional.of(linked));
        when(fixture.emailSender.isDeliveryAvailable()).thenReturn(true);
        when(fixture.appointments.countLiveHoldsForPatient(eq(linked.getId()), any())).thenReturn(2L);

        BookingService service = fixture.service();
        UserDetails principal = new User("patient@example.test", "ignored",
            List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));

        assertThatThrownBy(() -> service.holdSlot(holdRequest(doctorId, branchId), principal, null))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.TOO_MANY_ACTIVE_HOLDS);
        verify(fixture.appointments, never()).saveAndFlush(any());
    }

    @Test
    void repeatedIdempotencyKeyReplaysTheExistingHold() {
        HoldFixture fixture = new HoldFixture();
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        LocalDate date = LocalDate.now().plusDays(1);
        String key = "hold-key-0001";

        Appointment existing = new Appointment();
        existing.setId(UUID.randomUUID());
        existing.setBookingCode("APT-REPLAY");
        existing.setDoctor(activeDoctor(doctorId));
        existing.setBranch(activeBranch(branchId));
        existing.setAppointmentDate(date);
        existing.setStartTime(LocalTime.of(9, 0));
        existing.setEndTime(LocalTime.of(9, 30));
        existing.setStatus(com.healthcare.appointment.entity.AppointmentStatus.PENDING_CONFIRMATION);
        existing.setHoldExpiresAt(java.time.OffsetDateTime.now().plusMinutes(7));
        existing.setOtpExpiresAt(java.time.OffsetDateTime.now().plusMinutes(3));
        when(fixture.appointments.findByHoldIdempotencyKey(key)).thenReturn(Optional.of(existing));

        BookingService service = fixture.service();

        HoldSlotResponse replayed = service.holdSlot(holdRequest(doctorId, branchId), null, key);

        assertEquals("APT-REPLAY", replayed.bookingCode());
        assertEquals(OtpDeliveryStatus.QUEUED, replayed.otpDeliveryStatus());
        // The retry must not create a second hold, a second OTP, or another row.
        verify(fixture.appointments, never()).saveAndFlush(any());
        verifyNoInteractions(fixture.emailSender);
        verifyNoInteractions(fixture.schedules);
    }

    @Test
    void idempotencyKeyReusedForADifferentSlotIsRejected() {
        HoldFixture fixture = new HoldFixture();
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        String key = "hold-key-0002";

        Appointment otherSlot = new Appointment();
        otherSlot.setId(UUID.randomUUID());
        otherSlot.setBookingCode("APT-OTHER");
        otherSlot.setDoctor(activeDoctor(doctorId));
        otherSlot.setBranch(activeBranch(branchId));
        otherSlot.setAppointmentDate(LocalDate.now().plusDays(4));
        otherSlot.setStartTime(LocalTime.of(15, 0));
        otherSlot.setStatus(com.healthcare.appointment.entity.AppointmentStatus.PENDING_CONFIRMATION);
        otherSlot.setHoldExpiresAt(java.time.OffsetDateTime.now().plusMinutes(5));
        when(fixture.appointments.findByHoldIdempotencyKey(key)).thenReturn(Optional.of(otherSlot));

        BookingService service = fixture.service();

        assertThatThrownBy(() -> service.holdSlot(holdRequest(doctorId, branchId), null, key))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.CONFLICT);
        verify(fixture.appointments, never()).saveAndFlush(any());
    }

    @Test
    void malformedIdempotencyKeyIsRejected() {
        HoldFixture fixture = new HoldFixture();
        BookingService service = fixture.service();

        assertThatThrownBy(() -> service.holdSlot(
                holdRequest(UUID.randomUUID(), UUID.randomUUID()), null, "short"))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo(ErrorCodes.IDEMPOTENCY_KEY_INVALID);
    }
}
