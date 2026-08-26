package com.healthcare.auth.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;
import java.util.UUID;

/**
 * Defers delivery until the surrounding transaction commits. Callers without
 * an active transaction deliver immediately, which keeps scheduled and test
 * callers explicit and predictable.
 */
@Component
public class AfterCommitEmailSender {

    private static final Logger log = LoggerFactory.getLogger(AfterCommitEmailSender.class);

    private final EmailSender delegate;
    private final EmailTemplateRenderer renderer;

    @Autowired
    public AfterCommitEmailSender(EmailSender delegate) {
        this(delegate, new EmailTemplateRenderer());
    }

    public AfterCommitEmailSender(EmailSender delegate, EmailTemplateRenderer renderer) {
        this.delegate = delegate;
        this.renderer = renderer;
    }

    public boolean isDeliveryAvailable() {
        return delegate.isDeliveryAvailable();
    }

    public boolean isTransactionalOutbox() {
        return delegate instanceof TransactionalEmailSender;
    }

    public void sendBookingOtp(String recipient,
                               Map<String, String> variables,
                               String idempotencyKey,
                               UUID userId,
                               UUID eventReferenceId,
                               long ttlSeconds) {
        if (delegate instanceof TransactionalEmailSender transactional) {
            transactional.enqueue(
                EmailTemplateKey.BOOKING_OTP,
                recipient,
                variables,
                idempotencyKey,
                userId,
                eventReferenceId,
                "BOOKING_OTP",
                ttlSeconds
            );
            return;
        }
        sendTemplate(EmailTemplateKey.BOOKING_OTP, recipient, variables);
    }

    /**
     * Sends one of the code-owned templates through the richest delivery
     * boundary available. The non-outbox path is deliberately deferred until
     * commit and reports queueing to callers; it must never pretend that SMTP
     * accepted a message before the provider call actually ran.
     */
    public void sendTemplate(EmailTemplateKey templateKey,
                             String recipient,
                             Map<String, String> variables) {
        if (delegate instanceof TransactionalEmailSender transactional) {
            transactional.enqueue(
                templateKey,
                recipient,
                variables,
                EmailOutboxService.templateIdempotencyKey(templateKey, recipient, variables),
                null,
                null,
                templateKey.name(),
                900
            );
            return;
        }
        RenderedEmail rendered = renderer.render(templateKey, variables);
        runAfterCommit(() -> {
            if (delegate instanceof RichEmailDelivery richDelivery) {
                richDelivery.sendRich(
                    recipient,
                    rendered.subject(),
                    rendered.htmlBody(),
                    rendered.plainTextBody()
                );
            } else {
                delegate.send(recipient, rendered.subject(), rendered.plainTextBody());
            }
        });
    }

    public void send(String recipient, String subject, String body) {
        if (delegate instanceof TransactionalEmailSender transactional) {
            transactional.enqueue(
                EmailTemplateKey.SYSTEM_NOTIFICATION,
                recipient,
                Map.of("message", body == null ? "" : body),
                EmailOutboxService.templateIdempotencyKey(EmailTemplateKey.SYSTEM_NOTIFICATION, recipient,
                    Map.of("message", body == null ? "" : body)),
                null, null, "SYSTEM_NOTIFICATION", 900
            );
            return;
        }
        if (deliverWithinTransactionIfSupported(recipient, subject, body, false)) {
            return;
        }
        runAfterCommit(() -> delegate.send(recipient, subject, body));
    }

    /**
     * Delivers a non-security notification after commit without turning an
     * already committed business operation into an HTTP failure when SMTP is
     * temporarily unavailable. Recipient, subject, and body are deliberately
     * excluded from the log entry.
     */
    public void sendBestEffort(String recipient, String subject, String body) {
        if (delegate instanceof TransactionalEmailSender transactional) {
            try {
                Map<String, String> variables = Map.of("message", body == null ? "" : body);
                transactional.enqueue(
                    EmailTemplateKey.SYSTEM_NOTIFICATION, recipient, variables,
                    EmailOutboxService.templateIdempotencyKey(EmailTemplateKey.SYSTEM_NOTIFICATION, recipient, variables),
                    null, null, "SYSTEM_NOTIFICATION", 900
                );
            } catch (RuntimeException exception) {
                log.warn("Best-effort email queueing failed ({})", exception.getClass().getSimpleName());
            }
            return;
        }
        if (deliverWithinTransactionIfSupported(recipient, subject, body, true)) {
            return;
        }
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

    private boolean deliverWithinTransactionIfSupported(
        String recipient,
        String subject,
        String body,
        boolean bestEffort
    ) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !(delegate instanceof TransactionalEmailSender transactional)) {
            return false;
        }
        try {
            transactional.enqueue(recipient, subject, body);
            return true;
        } catch (RuntimeException exception) {
            if (bestEffort) {
                log.warn("Best-effort email delivery failed inside transaction ({})",
                    exception.getClass().getSimpleName());
                return true;
            }
            throw exception;
        }
    }
}
