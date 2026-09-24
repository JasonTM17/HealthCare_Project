package com.healthcare.payment;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.dto.BankTransferWebhookRequest;
import com.healthcare.payment.dto.SubmitBankTransferRequest;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.payment.service.PaymentAuditService;
import com.healthcare.payment.service.PaymentStatusEmailService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plan outcome: "Admin nhận thông báo khi có payment submission" — on both
 * submission origins.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code AdminAppointmentCancelTest}. A bank webhook deliberately leaves the
 * payment in {@code PENDING_VERIFICATION} because only an explicit admin review
 * may mark it PAID; that same queue therefore has to announce itself to the
 * admins, exactly like the patient-side submission does. The webhook case below
 * is the regression guard for that: it fails while the webhook only notifies the
 * patient.
 */
class BankTransferSubmissionAdminNotificationTest {

    private static final UUID APPOINTMENT_ID = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111");
    private static final UUID PATIENT_USER_ID = UUID.fromString("bbbbbbbb-2222-2222-2222-222222222222");
    private static final UUID CLAIMED_USER_ID = UUID.fromString("cccccccc-3333-3333-3333-333333333333");
    private static final UUID ADMIN_ONE = UUID.fromString("dddddddd-4444-4444-4444-444444444444");
    private static final UUID ADMIN_TWO = UUID.fromString("eeeeeeee-5555-5555-5555-555555555555");
    private static final String TRANSFER_CONTENT = "HC TEST 0001";
    private static final BigDecimal AMOUNT = new BigDecimal("150000");

    private final BankTransferPaymentRepository paymentRepository = mock(BankTransferPaymentRepository.class);
    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final PatientProfileRepository patientProfileRepository = mock(PatientProfileRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final PaymentAuditService auditService = mock(PaymentAuditService.class);
    private final AppointmentClaimService claimService = mock(AppointmentClaimService.class);
    private final PaymentStatusEmailService emailService = mock(PaymentStatusEmailService.class);
    private final BankTransferPaymentService service = new BankTransferPaymentService(
        paymentRepository, appointmentRepository, patientProfileRepository, userRepository,
        notifications, auditService, claimService, emailService);

    private UserDetails patientPrincipal;
    private User patientUser;
    private Appointment appointment;
    private BankTransferPayment payment;

    @BeforeEach
    void configureBankTransferAndFixtures() {
        // The @Value bank configuration is what requireConfigured() gates on;
        // mirror the test-profile values so the service is usable off-context.
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "bankName", "Test Bank");
        ReflectionTestUtils.setField(service, "bankAccount", "0000000000");
        ReflectionTestUtils.setField(service, "bankBin", "970436");
        ReflectionTestUtils.setField(service, "defaultAmount", new BigDecimal("200000"));

        patientUser = new User();
        patientUser.setId(PATIENT_USER_ID);
        patientUser.setEmail("patient@example.test");
        patientPrincipal = new org.springframework.security.core.userdetails.User(
            "patient@example.test", "not-used",
            java.util.List.<org.springframework.security.core.GrantedAuthority>of());

        appointment = new Appointment();
        appointment.setId(APPOINTMENT_ID);
        appointment.setBookingCode("HC-TEST-0001");
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        // toResponse derives the pay-by deadline from the visit start.
        appointment.setAppointmentDate(java.time.LocalDate.of(2030, 1, 15));
        appointment.setStartTime(java.time.LocalTime.of(13, 30));
        PatientProfile patient = new PatientProfile();
        patient.setId(UUID.fromString("ffffffff-6666-6666-6666-666666666666"));
        patient.setUserId(PATIENT_USER_ID);
        patient.setFullName("Nguyễn Văn A");
        appointment.setPatient(patient);
        Doctor doctor = new Doctor();
        doctor.setId(UUID.fromString("99999999-7777-7777-7777-777777777777"));
        doctor.setFullName("Bác sĩ Trần B");
        appointment.setDoctor(doctor);

        payment = new BankTransferPayment();
        payment.setAppointment(appointment);
        payment.setAmount(AMOUNT);
        payment.setTransferContent(TRANSFER_CONTENT);
        payment.setStatus(PaymentStatus.UNPAID);

        when(userRepository.findByEmail("patient@example.test")).thenReturn(Optional.of(patientUser));
        when(patientProfileRepository.findByUserId(PATIENT_USER_ID)).thenReturn(Optional.of(patient));
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(paymentRepository.findByAppointmentId(APPOINTMENT_ID)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByAppointmentIdForUpdate(APPOINTMENT_ID)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByTransferContentForUpdate(TRANSFER_CONTENT)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(BankTransferPayment.class))).thenAnswer(call -> call.getArgument(0));
        when(claimService.claimedUserIds(APPOINTMENT_ID)).thenReturn(List.of(PATIENT_USER_ID, CLAIMED_USER_ID));
        // ADMIN_ONE, ADMIN_TWO and the patient account, which also holds ADMIN.
        // The fan-out walks pages until an empty one, so page 2 must terminate.
        when(userRepository.findActiveAdminUserIds(any(Pageable.class)))
            .thenReturn(List.of(ADMIN_ONE, ADMIN_TWO, PATIENT_USER_ID))
            .thenReturn(List.of());
    }

    @Test
    @DisplayName("Patient submission notifies every active admin and the patient side")
    void manualSubmissionNotifiesAdmins() {
        service.submit(APPOINTMENT_ID, new SubmitBankTransferRequest("FT-9001"), "key-manual-1", patientPrincipal);

        verify(notifications).create(
            eq(ADMIN_ONE), eq(EventType.PAYMENT_SUBMITTED), eq("Có giao dịch chờ đối soát"),
            contains("HC-TEST-0001"), eq(APPOINTMENT_ID));
        verify(notifications).create(
            eq(ADMIN_TWO), eq(EventType.PAYMENT_SUBMITTED), eq("Có giao dịch chờ đối soát"),
            contains("HC-TEST-0001"), eq(APPOINTMENT_ID));
        verifyAdminFanOutIsBoundedAndDeduped();
    }

    @Test
    @DisplayName("Webhook-observed transfer notifies admins too: the review queue cannot stay silent")
    void webhookConfirmationNotifiesAdmins() {
        service.confirmFromWebhook(
            new BankTransferWebhookRequest(TRANSFER_CONTENT, AMOUNT, "FT-9002"), "evt-webhook-1");

        verify(notifications).create(
            eq(ADMIN_ONE), eq(EventType.PAYMENT_SUBMITTED), eq("Có giao dịch chờ đối soát"),
            contains("HC-TEST-0001"), eq(APPOINTMENT_ID));
        verify(notifications).create(
            eq(ADMIN_TWO), eq(EventType.PAYMENT_SUBMITTED), eq("Có giao dịch chờ đối soát"),
            contains("HC-TEST-0001"), eq(APPOINTMENT_ID));
        verifyAdminFanOutIsBoundedAndDeduped();
    }

    @Test
    @DisplayName("The webhook still leaves the payment for an admin instead of marking it PAID")
    void webhookNeverAuthorizesPaymentItself() {
        service.confirmFromWebhook(
            new BankTransferWebhookRequest(TRANSFER_CONTENT, AMOUNT, "FT-9003"), "evt-webhook-2");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
        assertThat(appointment.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION.name());
        verify(emailService, never()).paymentConfirmed(any());
    }

    /**
     * Shared invariants of both fan-outs: the reviewers are addressed through
     * the bounded admin query, the page bound is the documented cap, and an
     * admin who is also the patient is notified once — the reviewer copy — not
     * twice. Paging stops at the first empty page, so exactly one extra probe
     * happens beyond the single page of admins the stub returns.
     */
    private void verifyAdminFanOutIsBoundedAndDeduped() {
        ArgumentCaptor<Pageable> fanOut = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository, org.mockito.Mockito.times(2)).findActiveAdminUserIds(fanOut.capture());
        assertThat(fanOut.getAllValues().get(0).getPageSize()).isEqualTo(50);
        assertThat(fanOut.getAllValues().get(1).getPageNumber()).isEqualTo(1);

        // The patient account holds ADMIN, so it must not receive the reviewer
        // notice in addition to its own confirmation notice.
        verify(notifications, never()).create(
            eq(PATIENT_USER_ID), eq(EventType.PAYMENT_SUBMITTED), anyString(),
            contains("mục Thanh toán"), eq(APPOINTMENT_ID));

        // Two admins + the patient + the claimed account, and no duplicate.
        verify(notifications, times(4)).create(
            any(UUID.class), eq(EventType.PAYMENT_SUBMITTED), anyString(), anyString(), any(UUID.class));
    }
}
