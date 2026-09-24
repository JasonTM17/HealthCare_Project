package com.healthcare.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.payment.dto.BankTransferWebhookRequest;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The retry worker's failure taxonomy is the dead-letter queue's foundation:
 * a permanent conflict (wrong amount, cancelled booking, superseded
 * reference) must stop consuming the attempt budget and become an
 * admin-visible dead row, while a designed transient (booking not confirmed
 * yet) and infrastructure noise keep the normal defer behaviour.
 */
class PaymentWebhookRetryDeadLetterTest {

    private static final String SECRET = "test-only-payment-webhook-secret-at-least-32-chars";
    private static final BankTransferWebhookService.RecoveryEvent EVENT = new BankTransferWebhookService.RecoveryEvent(
        "evt-dead-1", new BankTransferWebhookRequest("HC TEST 0001", new BigDecimal("200000"), "FT-9001"));

    private final BankTransferPaymentService paymentService = mock(BankTransferPaymentService.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final BankTransferWebhookService service = new BankTransferWebhookService(
        paymentService, jdbcTemplate, new ObjectMapper(), mock(Validator.class),
        mock(PlatformTransactionManager.class));

    @BeforeEach
    void configureSecret() {
        ReflectionTestUtils.setField(service, "webhookSecret", SECRET);
        stubClaimReturning(EVENT);
    }

    @Test
    @DisplayName("The claim query excludes rows already marked as permanent failures")
    void claimQueryExcludesPermanentFailures() {
        when(paymentService.confirmFromWebhook(any(), anyString())).thenThrow(someConflict());

        service.retryPendingEvents();

        ArgumentCaptor<String> claimSql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.atLeastOnce())
            .query(claimSql.capture(), any(RowMapper.class));
        assertThat(claimSql.getValue()).contains("permanent_failure = false");
    }

    @Test
    @DisplayName("A permanent conflict dead-letters the row with its reason")
    void conflictMarksPermanentFailure() {
        when(paymentService.confirmFromWebhook(any(), eq("evt-dead-1"))).thenThrow(someConflict());

        int completed = service.retryPendingEvents();

        assertThat(completed).isZero();
        verify(jdbcTemplate).update(contains("permanent_failure = true"),
            eq("Số tiền webhook không khớp"), eq("evt-dead-1"));
    }

    @Test
    @DisplayName("A not-yet-confirmed booking defers silently instead of dead-lettering")
    void transientBookingConfirmationDefers() {
        when(paymentService.confirmFromWebhook(any(), eq("evt-dead-1")))
            .thenThrow(new PaymentNotYetConfirmableException("Lịch hẹn chưa hoàn tất xác nhận"));

        int completed = service.retryPendingEvents();

        assertThat(completed).isZero();
        verify(jdbcTemplate, never()).update(contains("permanent_failure = true"), any(), any());
    }

    @Test
    @DisplayName("Infrastructure noise keeps the plain defer behaviour")
    void infrastructureNoiseStillDefers() {
        when(paymentService.confirmFromWebhook(any(), eq("evt-dead-1")))
            .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Đang bận"));

        int completed = service.retryPendingEvents();

        assertThat(completed).isZero();
        verify(jdbcTemplate, never()).update(contains("permanent_failure = true"), any(), any());
    }

    @Test
    @DisplayName("A successful confirm reports completion without touching failure columns")
    void successfulConfirmCompletes() {
        when(paymentService.confirmFromWebhook(any(), eq("evt-dead-1")))
            .thenReturn(new com.healthcare.payment.dto.BankTransferPaymentResponse(
                java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), "HC-TEST-0001", "P", "D", null,
                java.time.LocalDate.of(2030, 1, 15), java.time.LocalTime.NOON, java.time.OffsetDateTime.now(),
                BigDecimal.ONE, "VND", com.healthcare.payment.entity.PaymentStatus.PENDING_VERIFICATION,
                null, null, null, null, "HC TEST 0001", "FT-9001", null, null, null, null, null,
                java.time.OffsetDateTime.now(), java.time.OffsetDateTime.now()));

        int completed = service.retryPendingEvents();

        assertThat(completed).isEqualTo(1);
        verify(jdbcTemplate).update(contains("set payment_id = ?"), any(), eq("evt-dead-1"));
        verify(jdbcTemplate, never()).update(contains("permanent_failure = true"), any(), any());
    }

    private ResponseStatusException someConflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Số tiền webhook không khớp");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubClaimReturning(BankTransferWebhookService.RecoveryEvent event) {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class)))
            .thenReturn(event == null ? List.of() : List.of(event), List.of());
    }
}
