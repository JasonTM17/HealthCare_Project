package com.healthcare.auth.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(AfterCommitEmailSender.class);

    private final EmailSender delegate;

    public AfterCommitEmailSender(EmailSender delegate) {
        this.delegate = delegate;
    }

    public boolean isDeliveryAvailable() {
        return delegate.isDeliveryAvailable();
    }

    public void send(String recipient, String subject, String body) {
        runAfterCommit(() -> delegate.send(recipient, subject, body));
    }

    /**
     * Delivers a non-security notification after commit without turning an
     * already committed business operation into an HTTP failure when SMTP is
     * temporarily unavailable. Recipient, subject, and body are deliberately
     * excluded from the log entry.
     */
    public void sendBestEffort(String recipient, String subject, String body) {
        runAfterCommit(() -> {
            try {
                delegate.send(recipient, subject, body);
            } catch (RuntimeException exception) {
                log.warn("Best-effort email delivery failed after transaction commit ({})",
                    exception.getClass().getSimpleName());
            }
        });
    }

    private void runAfterCommit(Runnable delivery) {
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    delivery.run();
                }
            });
            return;
        }
        delivery.run();
    }
}
