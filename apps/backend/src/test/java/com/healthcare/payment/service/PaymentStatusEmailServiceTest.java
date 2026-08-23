package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.payment.entity.BankTransferPayment;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PaymentStatusEmailServiceTest {

    private final AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
    private final PaymentStatusEmailService service = new PaymentStatusEmailService(emailSender, true);
    private BankTransferPayment payment;

    @BeforeEach
    void setUp() {
        reset(emailSender);
        when(emailSender.isDeliveryAvailable()).thenReturn(true);
        PatientProfile patient = new PatientProfile();
        patient.setEmail(" Patient@Example.com ");
        Appointment appointment = new Appointment();
        appointment.setBookingCode("APT-PAYMENT123");
        appointment.setPatient(patient);
        payment = new BankTransferPayment();
        payment.setAppointment(appointment);
        payment.setTransactionReference("FT-SENSITIVE-REFERENCE");
        payment.setRefundReference("RF-SENSITIVE-REFERENCE");
        payment.setRejectionReason("Sensitive reconciliation detail");
    }

    @Test
    void confirmedEmailContainsOnlySafePortalContext() {
        service.paymentConfirmed(payment);

        assertSafeDelivery("đã được xác nhận");
    }

    @Test
    void rejectedEmailDoesNotExposeReconciliationReason() {
        service.paymentRejected(payment);

        assertSafeDelivery("chưa được xác nhận");
    }

    @Test
    void refundedEmailDoesNotExposeRefundReference() {
        service.paymentRefunded(payment);

        assertSafeDelivery("hoàn tiền");
    }

    @Test
    void disabledStatusEmailDoesNotAttemptDelivery() {
        new PaymentStatusEmailService(emailSender, false).paymentConfirmed(payment);

        verifyNoInteractions(emailSender);
    }

    private void assertSafeDelivery(String expectedText) {
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailSender).sendBestEffort(
            org.mockito.ArgumentMatchers.eq("patient@example.com"), subject.capture(), body.capture());

        assertThat(subject.getValue()).startsWith("[HealthCare]");
        assertThat(body.getValue())
            .contains("APT-PAYMENT123", expectedText, "đăng nhập cổng bệnh nhân")
            .doesNotContain("FT-SENSITIVE-REFERENCE", "RF-SENSITIVE-REFERENCE",
                "Sensitive reconciliation detail", "account-number");
    }
}
