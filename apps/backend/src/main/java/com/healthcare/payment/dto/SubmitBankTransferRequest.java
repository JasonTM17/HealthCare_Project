package com.healthcare.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SubmitBankTransferRequest(
    @NotBlank
    @Size(min = 6, max = 100)
    @Pattern(regexp = "[A-Za-z0-9._\\-/ ]+", message = "Mã giao dịch chỉ được chứa chữ, số và . _ - /")
    String transactionReference
) {
}
