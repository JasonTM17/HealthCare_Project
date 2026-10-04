package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.payment.entity.BankTransferPayment;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
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

    @Test
    void delegateUnavailabilityStillAttemptsBestEffortDelivery() {
        // isDeliveryAvailable() reports only the delegate sender's reachability;
        // with an API-only sender configured it returns false even though the
        // send path is live, so the service must not consult it at all.
        when(emailSender.isDeliveryAvailable()).thenReturn(false);

        service.paymentConfirmed(payment);

        org.mockito.Mockito.verify(emailSender).sendTemplateBestEffort(
            org.mockito.ArgumentMatchers.eq(com.healthcare.auth.mail.EmailTemplateKey.PAYMENT_STATUS),
            org.mockito.ArgumentMatchers.eq("patient@example.com"),
            org.mockito.ArgumentMatchers.anyMap());
    }

    @Test
    void successiveRejectionsProduceDistinctTransitionKeys() {
        org.springframework.test.util.ReflectionTestUtils.setField(payment, "id",
            java.util.UUID.fromString("cccccccc-3333-3333-3333-333333333333"));

        service.paymentRejected(payment);
        // A resubmission then a second rejection bumps updatedAt, so the
        // transition key — and therefore the outbox idempotency key — differs.
        org.springframework.test.util.ReflectionTestUtils.setField(payment, "updatedAt",
            java.time.OffsetDateTime.now().plusSeconds(1));
        service.paymentRejected(payment);

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        org.mockito.Mockito.verify(emailSender, org.mockito.Mockito.times(2)).sendTemplateBestEffort(
            org.mockito.ArgumentMatchers.eq(com.healthcare.auth.mail.EmailTemplateKey.PAYMENT_STATUS),
            org.mockito.ArgumentMatchers.eq("patient@example.com"), variables.capture());

        Map<String, String> first = variables.getAllValues().get(0);
        Map<String, String> second = variables.getAllValues().get(1);
        assertThat(first.get("message")).isEqualTo(second.get("message"));
        assertThat(first.get("transitionKey")).isNotEqualTo(second.get("transitionKey"));
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void paymentStatusUpdateDoesNotFailWhenEmailBestEffortDeliveryFails() {
        doThrow(new IllegalStateException("SMTP unavailable")).when(emailSender).sendTemplateBestEffort(
            org.mockito.ArgumentMatchers.eq(com.healthcare.auth.mail.EmailTemplateKey.PAYMENT_STATUS),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyMap());

        assertDoesNotThrow(() -> service.paymentConfirmed(payment));
    }

    private void assertSafeDelivery(String expectedText) {
        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(emailSender).sendTemplateBestEffort(
            org.mockito.ArgumentMatchers.eq(com.healthcare.auth.mail.EmailTemplateKey.PAYMENT_STATUS),
            org.mockito.ArgumentMatchers.eq("patient@example.com"), variables.capture());

        assertThat(variables.getValue().get("message"))
            .contains("APT-PAYMENT123", expectedText)
            .doesNotContain("FT-SENSITIVE-REFERENCE", "RF-SENSITIVE-REFERENCE",
                "Sensitive reconciliation detail", "account-number");
    }
}
