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
    private final org.springframework.beans.factory.ObjectProvider<ApiEmailSender> apiSender;

    @Autowired
    public AfterCommitEmailSender(EmailSender delegate,
                                  org.springframework.beans.factory.ObjectProvider<ApiEmailSender> apiSender) {
        this(delegate, new EmailTemplateRenderer(), apiSender);
    }

    public AfterCommitEmailSender(EmailSender delegate) {
        this(delegate, new EmailTemplateRenderer(), null);
    }

    public AfterCommitEmailSender(EmailSender delegate, EmailTemplateRenderer renderer) {
        this(delegate, renderer, null);
    }

    public AfterCommitEmailSender(EmailSender delegate, EmailTemplateRenderer renderer,
                                  org.springframework.beans.factory.ObjectProvider<ApiEmailSender> apiSender) {
        this.delegate = delegate;
        this.renderer = renderer;
        this.apiSender = apiSender;
    }

    /**
     * True when the Resend HTTPS API is configured. Render Free cannot reach
     * outbound SMTP (smtp.gmail.com:587 times out), so the API path takes
     * precedence over the outbox/SMTP delegates whenever it is available.
     */
    private boolean apiPreferred() {
        if (apiSender == null) {
            return false;
        }
        ApiEmailSender sender = apiSender.getIfAvailable();
        return sender != null && sender.isConfigured();
    }

    private void deliverViaApi(String recipient, RenderedEmail rendered, boolean bestEffort) {
        ApiEmailSender sender = apiSender.getIfAvailable();
        if (sender == null) {
            return;
        }
        if (bestEffort) {
            try {
                sender.sendRich(recipient, rendered.subject(), rendered.htmlBody(), rendered.plainTextBody());
            } catch (RuntimeException exception) {
                log.warn("Best-effort API email delivery failed (template path, recipient={}) cause={}",
                    recipient, exception.getClass().getSimpleName());
            }
            return;
        }
        sender.sendRich(recipient, rendered.subject(), rendered.htmlBody(), rendered.plainTextBody());
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
        if (apiPreferred()) {
            // Resend HTTPS route: Render Free egress cannot reach SMTP, so the
            // API path outranks both the outbox and the SMTP delegate.
            RenderedEmail rendered = renderer.render(templateKey, variables);
            runAfterCommit(() -> deliverViaApi(recipient, rendered, false));
            return;
        }
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
        runAfterCommit(() -> deliverRendered(recipient, rendered));
    }

    /**
     * Sends a typed template through the durable outbox when present; otherwise
     * delivery is attempted after commit and SMTP/provider failures are logged
     * without failing the already accepted user-facing operation.
     */
    public void sendTemplateBestEffort(EmailTemplateKey templateKey,
                                       String recipient,
                                       Map<String, String> variables) {
        if (apiPreferred()) {
            RenderedEmail rendered = renderer.render(templateKey, variables);
            log.info("Email delivery using Resend API path (template={})", templateKey);
            runAfterCommit(() -> deliverViaApi(recipient, rendered, true));
            return;
        }
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
        log.info("Email delivery using best-effort non-outbox path (template={})", templateKey);
        RenderedEmail rendered = renderer.render(templateKey, variables);
        runAfterCommit(() -> {
            try {
                deliverRendered(recipient, rendered);
            } catch (RuntimeException exception) {
                log.warn("Best-effort template email delivery failed after transaction commit (template={}, cause={})",
                    templateKey, exception.getClass().getSimpleName());
            }
        });
    }

    public void sendSystemNotification(String recipient,
                                       String message,
                                       String idempotencyKey,
                                       UUID userId,
                                       UUID eventReferenceId,
                                       String eventType,
                                       long ttlSeconds) {
        Map<String, String> variables = Map.of("message", message == null ? "" : message);
        if (delegate instanceof TransactionalEmailSender transactional) {
            transactional.enqueue(
                EmailTemplateKey.SYSTEM_NOTIFICATION,
                recipient,
                variables,
                idempotencyKey,
                userId,
                eventReferenceId,
                eventType,
                ttlSeconds
            );
            return;
        }
        sendTemplate(EmailTemplateKey.SYSTEM_NOTIFICATION, recipient, variables);
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

    private void deliverRendered(String recipient, RenderedEmail rendered) {
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
