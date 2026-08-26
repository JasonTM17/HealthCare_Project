package com.healthcare.auth.mail;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.anyLong;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class AfterCommitEmailSenderTest {

    private final EmailSender delegate = mock(EmailSender.class);
    private final AfterCommitEmailSender sender = new AfterCommitEmailSender(delegate);

    @AfterEach
    void clearTransactionState() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    @Test
    void activeTransactionDefersDeliveryUntilAfterCommit() {
        beginTransactionSynchronization();

        sender.send("patient@example.com", "subject", "body");

        verifyNoInteractions(delegate);
        TransactionSynchronizationManager.getSynchronizations()
            .forEach(TransactionSynchronization::afterCommit);
        verify(delegate).send("patient@example.com", "subject", "body");
    }

    @Test
    void rolledBackTransactionDoesNotDeliver() {
        beginTransactionSynchronization();

        sender.send("patient@example.com", "subject", "body");
        TransactionSynchronizationManager.getSynchronizations()
            .forEach(synchronization -> synchronization.afterCompletion(
                TransactionSynchronization.STATUS_ROLLED_BACK
            ));

        verifyNoInteractions(delegate);
    }

    @Test
    void callerWithoutTransactionDeliversImmediately() {
        sender.send("patient@example.com", "subject", "body");

        verify(delegate).send("patient@example.com", "subject", "body");
    }

    @Test
    void transactionalOutboxIsWrittenBeforeBusinessCommit() {
        EmailSender transactionalDelegate = mock(EmailSender.class,
            org.mockito.Mockito.withSettings().extraInterfaces(TransactionalEmailSender.class));
        AfterCommitEmailSender transactionalSender = new AfterCommitEmailSender(transactionalDelegate);
        beginTransactionSynchronization();

        assertThat(transactionalSender.isTransactionalOutbox()).isTrue();
        transactionalSender.send("patient@example.com", "subject", "body");

        verify((TransactionalEmailSender) transactionalDelegate).enqueue(
            org.mockito.ArgumentMatchers.eq(EmailTemplateKey.SYSTEM_NOTIFICATION),
            org.mockito.ArgumentMatchers.eq("patient@example.com"),
            org.mockito.ArgumentMatchers.eq(Map.of("message", "body")),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.eq("SYSTEM_NOTIFICATION"), org.mockito.ArgumentMatchers.eq(900L));
        verify(transactionalDelegate, org.mockito.Mockito.never()).send("patient@example.com", "subject", "body");
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    void bookingOtpUsesTypedOutboxBridgeWhenAvailable() {
        EmailSender transactionalDelegate = mock(EmailSender.class,
            org.mockito.Mockito.withSettings().extraInterfaces(TransactionalEmailSender.class));
        AfterCommitEmailSender transactionalSender = new AfterCommitEmailSender(transactionalDelegate);

        transactionalSender.sendBookingOtp(
            "patient@example.com",
            Map.of("code", "123456", "minutes", "5"),
            "booking-otp-123",
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            UUID.fromString("00000000-0000-0000-0000-000000000002"),
            300L
        );

        verify((TransactionalEmailSender) transactionalDelegate).enqueue(
            EmailTemplateKey.BOOKING_OTP,
            "patient@example.com",
            Map.of("code", "123456", "minutes", "5"),
            "booking-otp-123",
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            UUID.fromString("00000000-0000-0000-0000-000000000002"),
            "BOOKING_OTP",
            300L
        );
        verify(transactionalDelegate, org.mockito.Mockito.never()).send("patient@example.com", "subject", "body");
    }

    @Test
    void nonOutboxTemplateUsesRichHtmlAndPlainTextDelivery() {
        EmailSender richDelegate = mock(EmailSender.class,
            org.mockito.Mockito.withSettings().extraInterfaces(RichEmailDelivery.class));
        AfterCommitEmailSender richSender = new AfterCommitEmailSender(richDelegate);

        richSender.sendTemplate(
            EmailTemplateKey.BOOKING_OTP,
            "patient@example.com",
            Map.of("code", "123456", "minutes", "5")
        );

        verify((RichEmailDelivery) richDelegate).sendRich(
            org.mockito.Mockito.eq("patient@example.com"),
            org.mockito.Mockito.eq("[HealthCare] Xác nhận đặt lịch"),
            org.mockito.Mockito.contains("123456"),
            org.mockito.Mockito.contains("123456")
        );
        verify(richDelegate, org.mockito.Mockito.never()).send(
            org.mockito.Mockito.eq("patient@example.com"),
            org.mockito.Mockito.anyString(),
            org.mockito.Mockito.anyString()
        );
    }

    @Test
    void bestEffortNotificationDoesNotFailCommittedOperationWhenSmtpFails() {
        beginTransactionSynchronization();
        doThrow(new IllegalStateException("SMTP unavailable"))
            .when(delegate).send("patient@example.com", "subject", "body");

        sender.sendBestEffort("patient@example.com", "subject", "body");

        assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations()
            .forEach(TransactionSynchronization::afterCommit));
        verify(delegate).send("patient@example.com", "subject", "body");
    }

    private void beginTransactionSynchronization() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }
}
