package com.healthcare.payment;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.payment.dto.BankTransferWebhookRequest;
import com.healthcare.payment.dto.RefundBankTransferRequest;
import com.healthcare.payment.dto.ReviewBankTransferRequest;
import com.healthcare.payment.dto.SubmitBankTransferRequest;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.payment.service.PaymentAuditService;
import com.healthcare.payment.service.PaymentNotYetConfirmableException;
import com.healthcare.payment.service.PaymentStatusEmailService;
import com.healthcare.payment.service.VietQrChannelProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mockito-only state-machine guard for the bank-transfer payment, in the style
 * of {@code BankTransferSubmissionAdminNotificationTest}. Every branch an
 * administrator can hit from the review queue — replays, resubmissions after a
 * rejection,VERIFY/REJECT gating, refunds, and the two webhook gates — must
 * either advance the state or conflict loudly, never silently corrupt it.
 */
class BankTransferPaymentStateMachineTest {

    private static final UUID APPOINTMENT_ID = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111");
    private static final UUID PAYMENT_ID = UUID.fromString("cccccccc-3333-3333-3333-333333333333");
    private static final UUID PATIENT_USER_ID = UUID.fromString("bbbbbbbb-2222-2222-2222-222222222222");
    private static final String TRANSFER_CONTENT = "HC TEST 0001";
    private static final BigDecimal AMOUNT = new BigDecimal("200000");
    private static final String REFERENCE = "FT-9001";

    private final BankTransferPaymentRepository paymentRepository = mock(BankTransferPaymentRepository.class);
    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final PatientProfileRepository patientProfileRepository = mock(PatientProfileRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final PaymentAuditService auditService = mock(PaymentAuditService.class);
    private final AppointmentClaimService claimService = mock(AppointmentClaimService.class);
    private final PaymentStatusEmailService emailService = mock(PaymentStatusEmailService.class);
    private final VietQrChannelProvider channelProvider = new VietQrChannelProvider();
    private final BankTransferPaymentService service = new BankTransferPaymentService(
        paymentRepository, appointmentRepository, patientProfileRepository, userRepository,
        mock(com.healthcare.notification.service.NotificationService.class), auditService, claimService,
        emailService, channelProvider);

    private UserDetails patientPrincipal;
    private UserDetails adminPrincipal;
    private Appointment appointment;
    private BankTransferPayment payment;

    @BeforeEach
    void configureServiceAndFixtures() {
        ReflectionTestUtils.setField(service, "configuredProvider", VietQrChannelProvider.PROVIDER_ID);
        ReflectionTestUtils.setField(service, "defaultAmount", AMOUNT);
        ReflectionTestUtils.setField(service, "payByHoursBeforeAppointment", 2);
        ReflectionTestUtils.setField(channelProvider, "enabled", true);
        ReflectionTestUtils.setField(channelProvider, "bankName", "Test Bank");
        ReflectionTestUtils.setField(channelProvider, "bankAccount", "0000000000");
        ReflectionTestUtils.setField(channelProvider, "bankBin", "970436");
        ReflectionTestUtils.setField(channelProvider, "accountHolder", "HEALTHCARE TEST");

        User patientUser = new User();
        patientUser.setId(PATIENT_USER_ID);
        patientUser.setEmail("patient@example.test");
        User adminUser = new User();
        adminUser.setId(UUID.fromString("dddddddd-4444-4444-4444-444444444444"));
        adminUser.setEmail("admin@example.test");
        patientPrincipal = principal("patient@example.test");
        adminPrincipal = principal("admin@example.test");

        appointment = new Appointment();
        appointment.setId(APPOINTMENT_ID);
        appointment.setBookingCode("HC-TEST-0001");
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setAppointmentDate(LocalDate.of(2030, 1, 15));
        appointment.setStartTime(LocalTime.of(13, 30));
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
        when(userRepository.findByEmail("admin@example.test")).thenReturn(Optional.of(adminUser));
        when(patientProfileRepository.findByUserId(PATIENT_USER_ID)).thenReturn(Optional.of(patient));
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(paymentRepository.findByAppointmentId(APPOINTMENT_ID)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByAppointmentIdForUpdate(APPOINTMENT_ID)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByIdForUpdate(PAYMENT_ID)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByTransferContentForUpdate(TRANSFER_CONTENT)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(BankTransferPayment.class))).thenAnswer(call -> call.getArgument(0));
        when(claimService.claimedUserIds(APPOINTMENT_ID)).thenReturn(List.of());
        when(userRepository.findActiveAdminUserIds(any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("Replaying the same idempotency key and reference returns the current row untouched")
    void replaySameKeyAndReferenceIsReadOnly() {
        submit(REFERENCE, "key-1");
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);

        var response = submit(REFERENCE, "key-1");

        assertThat(response.status()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
        // Exactly one write: the initial transition. The replay is read-only.
        org.mockito.Mockito.verify(paymentRepository, org.mockito.Mockito.times(1)).save(any());
    }

    @Test
    @DisplayName("The same idempotency key with a different reference conflicts")
    void sameKeyWithDifferentReferenceConflicts() {
        submit(REFERENCE, "key-1");

        assertThatThrownBy(() -> submit("FT-9999", "key-1"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("A different reference while PENDING_VERIFICATION conflicts")
    void differentReferenceWhilePendingConflicts() {
        submit(REFERENCE, "key-1");

        assertThatThrownBy(() -> submit("FT-9999", "key-2"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
    }

    @Test
    @DisplayName("After a rejection the same key and reference is a resubmission, not a dead end")
    void sameKeyAndReferenceAfterRejectionResubmits() {
        submit(REFERENCE, "key-1");
        reject("Sai số tiền");
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REJECTED);

        var response = submit(REFERENCE, "key-1");

        assertThat(response.status()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
        assertThat(payment.getRejectionReason()).isNull();
        assertThat(appointment.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION.name());
    }

    @Test
    @DisplayName("After a rejection a new reference under the same key also resubmits")
    void newReferenceAfterRejectionResubmits() {
        submit(REFERENCE, "key-1");
        reject("Sai số tiền");

        var response = submit("FT-7777", "key-1");

        assertThat(response.status()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
        assertThat(payment.getTransactionReference()).isEqualTo("FT-7777");
    }

    @Test
    @DisplayName("A PAID payment never regresses through submit")
    void paidPaymentIsTerminalForSubmit() {
        submit(REFERENCE, "key-1");
        forcePaymentStatus(PaymentStatus.PAID);

        var response = submit(REFERENCE, "key-2");

        assertThat(response.status()).isEqualTo(PaymentStatus.PAID);
        // Only the initial transition wrote; the terminal replay is read-only.
        org.mockito.Mockito.verify(paymentRepository, org.mockito.Mockito.times(1)).save(any());
    }

    @Test
    @DisplayName("VERIFY on an unconfirmed hold conflicts instead of authorizing PAID")
    void verifyBlockedWhileAppointmentAwaitingConfirmation() {
        submit(REFERENCE, "key-1");
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);

        assertThatThrownBy(() -> review(ReviewBankTransferRequest.Decision.VERIFY, null))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING_VERIFICATION);
    }

    @Test
    @DisplayName("VERIFY on a hold-expired cancelled appointment quotes the refund guidance")
    void verifyBlockedForHoldExpiredAppointment() {
        submit(REFERENCE, "key-1");
        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(BookingService.HOLD_EXPIRED_CANCELLATION_REASON);

        assertThatThrownBy(() -> review(ReviewBankTransferRequest.Decision.VERIFY, null))
            .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(ex.getReason()).contains("quá hạn giữ chỗ").contains("hoàn lại");
            });
    }

    @Test
    @DisplayName("VERIFY advances PENDING_VERIFICATION to PAID and syncs the appointment")
    void verifyMarksPaidAndSyncsAppointment() {
        submit(REFERENCE, "key-1");

        var response = review(ReviewBankTransferRequest.Decision.VERIFY, null);

        assertThat(response.status()).isEqualTo(PaymentStatus.PAID);
        assertThat(payment.getVerifiedAt()).isNotNull();
        assertThat(appointment.getPaymentStatus()).isEqualTo(PaymentStatus.PAID.name());
        verify(emailService).paymentConfirmed(payment);
    }

    @Test
    @DisplayName("REJECT only applies to the review queue and records the reason")
    void rejectRequiresPendingVerification() {
        assertThatThrownBy(() -> review(ReviewBankTransferRequest.Decision.REJECT, "Không tìm thấy giao dịch"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Webhook on an unconfirmed hold is a designed transient, not a corruption")
    void webhookOnUnconfirmedHoldIsTransient() {
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);

        assertThatThrownBy(() -> service.confirmFromWebhook(
                new BankTransferWebhookRequest(TRANSFER_CONTENT, AMOUNT, REFERENCE), "evt-1"))
            .isInstanceOf(PaymentNotYetConfirmableException.class);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Webhook on a cancelled appointment conflicts permanently")
    void webhookOnCancelledAppointmentConflicts() {
        appointment.setStatus(AppointmentStatus.CANCELLED);

        assertThatThrownBy(() -> service.confirmFromWebhook(
                new BankTransferWebhookRequest(TRANSFER_CONTENT, AMOUNT, REFERENCE), "evt-2"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Webhook amount must match the initialized amount exactly")
    void webhookAmountMismatchConflicts() {
        assertThatThrownBy(() -> service.confirmFromWebhook(
                new BankTransferWebhookRequest(TRANSFER_CONTENT, AMOUNT.add(BigDecimal.ONE), REFERENCE), "evt-3"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Refund completes only from REFUND_PENDING and replays with the same reference")
    void refundRequiresRefundPendingThenReplays() {
        submit(REFERENCE, "key-1");
        forcePaymentStatus(PaymentStatus.PAID);

        // Direct PAID is not refundable: the refund flow starts from cancellation.
        assertThatThrownBy(() -> service.refund(PAYMENT_ID,
                new RefundBankTransferRequest("REFUND-0001"), adminPrincipal))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        payment.setStatus(PaymentStatus.REFUND_PENDING);
        var response = service.refund(PAYMENT_ID,
            new RefundBankTransferRequest("REFUND-0001"), adminPrincipal);
        assertThat(response.status()).isEqualTo(PaymentStatus.REFUNDED);

        // Replay with the same reference is a read-only no-op...
        var replay = service.refund(PAYMENT_ID,
            new RefundBankTransferRequest("REFUND-0001"), adminPrincipal);
        assertThat(replay.status()).isEqualTo(PaymentStatus.REFUNDED);

        // ...while a different reference conflicts loudly.
        assertThatThrownBy(() -> service.refund(PAYMENT_ID,
                new RefundBankTransferRequest("REFUND-0002"), adminPrincipal))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    private com.healthcare.payment.dto.BankTransferPaymentResponse submit(String reference, String key) {
        return service.submit(APPOINTMENT_ID, new SubmitBankTransferRequest(reference), key, patientPrincipal);
    }

    private void reject(String reason) {
        review(ReviewBankTransferRequest.Decision.REJECT, reason);
    }

    private com.healthcare.payment.dto.BankTransferPaymentResponse review(
            ReviewBankTransferRequest.Decision decision, String reason) {
        return service.review(PAYMENT_ID, new ReviewBankTransferRequest(decision, reason), adminPrincipal);
    }

    /** Places the payment in a state a real admin decision would have produced. */
    private void forcePaymentStatus(PaymentStatus expected) {
        payment.setStatus(expected);
        appointment.setPaymentStatus(expected.name());
    }

    private static UserDetails principal(String email) {
        return new org.springframework.security.core.userdetails.User(
            email, "not-used", List.of());
    }
}
