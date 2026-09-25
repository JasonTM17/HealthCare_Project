package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentInvoice;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.payment.repository.PaymentInvoiceRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Receipt issuance is a governed write: only verified payments get one, the
 * first issuance is the only issuance (replays return the stored snapshot),
 * and the numbering shape stays stable for the hospital's records.
 */
class PaymentInvoiceServiceTest {

    private static final UUID APPOINTMENT_ID = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111");
    private static final UUID PAYMENT_ID = UUID.fromString("cccccccc-3333-3333-3333-333333333333");
    private static final UUID PATIENT_USER_ID = UUID.fromString("bbbbbbbb-2222-2222-2222-222222222222");

    private final BankTransferPaymentService paymentService = mock(BankTransferPaymentService.class);
    private final PaymentInvoiceRepository invoiceRepository = mock(PaymentInvoiceRepository.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final PaymentReceiptPdfRenderer renderer = new PaymentReceiptPdfRenderer();
    private final PaymentInvoiceService service = new PaymentInvoiceService(
        paymentService, invoiceRepository, renderer, jdbcTemplate);

    private final UserDetails patientPrincipal = principal("patient@example.test");
    private BankTransferPayment payment;

    @BeforeEach
    void fixture() {
        Appointment appointment = new Appointment();
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
        // The entity has no id setter outside JPA; the receipt flow keys on it.
        org.springframework.test.util.ReflectionTestUtils.setField(payment, "id", PAYMENT_ID);
        payment.setAppointment(appointment);
        payment.setAmount(new BigDecimal("200000"));
        payment.setCurrency("VND");
        payment.setTransferContent("HC TEST 0001");
        payment.setTransactionReference("FT-9001");
        payment.setStatus(PaymentStatus.PAID);

        when(paymentService.loadOwnedPaymentForUpdate(eq(APPOINTMENT_ID), any()))
            .thenReturn(payment);
        when(invoiceRepository.findByPaymentId(PAYMENT_ID)).thenReturn(Optional.empty());
        when(invoiceRepository.saveAndFlush(any(PaymentInvoice.class)))
            .thenAnswer(call -> call.getArgument(0));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(42L);
    }

    @Test
    @DisplayName("Issuance snapshots the payment facts and numbers the receipt HD-YYYY-NNNNNN")
    void issuanceSnapshotsAndNumbers() {
        byte[] pdf = service.receiptForPatient(APPOINTMENT_ID, patientPrincipal);

        assertThat(pdf).startsWith(new byte[] {'%', 'P', 'D', 'F'});
        org.mockito.ArgumentCaptor<PaymentInvoice> saved =
            org.mockito.ArgumentCaptor.forClass(PaymentInvoice.class);
        verify(invoiceRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getInvoiceNumber())
            .matches("HD-\\d{4}-000042");
        assertThat(saved.getValue().getBookingCode()).isEqualTo("HC-TEST-0001");
        assertThat(saved.getValue().getPatientName()).isEqualTo("Nguyễn Văn A");
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("200000");
    }

    @Test
    @DisplayName("A repeat download replays the stored invoice instead of issuing another")
    void replayReusesTheStoredInvoice() {
        PaymentInvoice existing = new PaymentInvoice();
        existing.setPaymentId(PAYMENT_ID);
        existing.setInvoiceNumber("HD-2026-000007");
        existing.setIssuedAt(java.time.OffsetDateTime.now());
        existing.setAmount(new BigDecimal("200000"));
        existing.setCurrency("VND");
        existing.setPatientName("Nguyễn Văn A");
        existing.setBookingCode("HC-TEST-0001");
        when(invoiceRepository.findByPaymentId(PAYMENT_ID)).thenReturn(Optional.of(existing));

        service.receiptForPatient(APPOINTMENT_ID, patientPrincipal);

        verify(invoiceRepository, never()).saveAndFlush(any());
        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Long.class));
    }

    @Test
    @DisplayName("Unverified payment states are refused a receipt")
    void unverifiedStatesAreRefused() {
        for (PaymentStatus status : List.of(PaymentStatus.UNPAID, PaymentStatus.PENDING_VERIFICATION,
                PaymentStatus.REJECTED)) {
            payment.setStatus(status);
            assertThatThrownBy(() -> service.receiptForPatient(APPOINTMENT_ID, patientPrincipal))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                    ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        }
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    private static UserDetails principal(String email) {
        return new org.springframework.security.core.userdetails.User(
            email, "not-used", List.of());
    }
}
