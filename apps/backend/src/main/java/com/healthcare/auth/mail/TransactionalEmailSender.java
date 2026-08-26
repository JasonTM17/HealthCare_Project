package com.healthcare.auth.mail;

import java.util.Map;
import java.util.UUID;

/**
 * Marker for a mail implementation that persists an encrypted outbox row in
 * the caller's transaction.  AfterCommitEmailSender uses this boundary so an
 * OTP hold and its queue record commit or roll back together.
 */
public interface TransactionalEmailSender {

    void enqueue(String recipient, String subject, String body);

    EmailOutboxEntry enqueue(EmailTemplateKey templateKey,
                             String recipient,
                             Map<String, String> variables,
                             String idempotencyKey,
                             UUID userId,
                             UUID eventReferenceId,
                             String eventType,
                             long ttlSeconds);
}
