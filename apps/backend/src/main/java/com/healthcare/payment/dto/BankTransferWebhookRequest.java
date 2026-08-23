package com.healthcare.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record BankTransferWebhookRequest(
    @NotBlank @Size(max = 64) String transferContent,
    @NotNull @DecimalMin("1") BigDecimal amount,
    @NotBlank @Size(max = 100) String transactionReference
) {
}
