package com.healthcare.auth.mail;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Defers delivery until the surrounding transaction commits. Callers without
 * an active transaction deliver immediately, which keeps scheduled and test
 * callers explicit and predictable.
 */
@Component
public class AfterCommitEmailSender {

    private final EmailSender delegate;

    public AfterCommitEmailSender(EmailSender delegate) {
        this.delegate = delegate;
    }

    public boolean isDeliveryAvailable() {
        return delegate.isDeliveryAvailable();
    }

    public void send(String recipient, String subject, String body) {
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    delegate.send(recipient, subject, body);
                }
            });
            return;
        }
        delegate.send(recipient, subject, body);
    }
}
