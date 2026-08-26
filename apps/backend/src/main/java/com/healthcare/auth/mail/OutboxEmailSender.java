package com.healthcare.auth.mail;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Enables the durable queue only when explicitly opted in by the runtime. */
@Component
@Primary
@ConditionalOnProperty(prefix = "app.mail.outbox", name = "enabled", havingValue = "true")
public class OutboxEmailSender implements EmailSender, TransactionalEmailSender {

    private final EmailOutboxService outbox;

    public OutboxEmailSender(EmailOutboxService outbox) {
        this.outbox = outbox;
    }

    @Override
    public void enqueue(String recipient, String subject, String body) {
        outbox.enqueue(recipient, subject, body);
    }

    @Override
    public EmailOutboxEntry enqueue(EmailTemplateKey templateKey,
                                    String recipient,
                                    Map<String, String> variables,
                                    String idempotencyKey,
                                    UUID userId,
                                    UUID eventReferenceId,
                                    String eventType,
                                    long ttlSeconds) {
        return outbox.enqueue(templateKey, recipient, variables, idempotencyKey, userId, eventReferenceId, eventType, ttlSeconds);
    }

    @Override
    public void send(String recipient, String subject, String body) {
        enqueue(recipient, subject, body);
    }

    @Override
    public boolean isDeliveryAvailable() {
        return true;
    }
}
