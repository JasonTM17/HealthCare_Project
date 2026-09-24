package com.healthcare.payment.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Read-only row of the admin bank-notification list. Unprocessed rows with
 * {@code permanentFailure} set are the dead-letter queue: the retry worker has
 * proven they can never be matched (wrong amount, cancelled booking,
 * superseded reference) and an administrator has to resolve them by hand.
 */
public record PaymentWebhookEventAdminView(
    String eventId,
    String transferContent,
    BigDecimal amount,
    String transactionReference,
    OffsetDateTime receivedAt,
    Integer retryAttempts,
    OffsetDateTime nextRetryAt,
    OffsetDateTime processedAt,
    boolean permanentFailure,
    String failureReason
) {
}
