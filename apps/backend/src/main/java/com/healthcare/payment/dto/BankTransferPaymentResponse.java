package com.healthcare.payment.dto;

import com.healthcare.payment.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BankTransferPaymentResponse(
    UUID id,
    UUID appointmentId,
    String bookingCode,
    String patientName,
    String doctorName,
    String packageName,
    LocalDate appointmentDate,
    BigDecimal amount,
    String currency,
    PaymentStatus status,
    String bankName,
    String bankAccount,
    String accountHolder,
    String qrCodeUrl,
    String transferContent,
    String transactionReference,
    OffsetDateTime submittedAt,
    OffsetDateTime verifiedAt,
    String rejectionReason,
    String refundReference,
    OffsetDateTime refundedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
