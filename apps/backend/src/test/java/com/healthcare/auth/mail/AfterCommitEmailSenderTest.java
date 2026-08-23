package com.healthcare.auth.mail;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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

    private void beginTransactionSynchronization() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }
}
