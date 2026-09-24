package com.healthcare.payment.dto;

import com.healthcare.payment.entity.PaymentStatus;

import java.util.UUID;

/**
 * Minimal webhook acknowledgement: the bank only needs to know that its event
 * was accepted and which queue entry it produced. Echoing the full payment
 * response would hand the bank account number, patient name and transaction
 * references to whichever caller holds the webhook secret.
 */
public record BankTransferWebhookAck(UUID paymentId, PaymentStatus status, String transferContent) {
}
