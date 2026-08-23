package com.healthcare.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RefundBankTransferRequest(
    @NotBlank
    @Size(min = 6, max = 100)
    @Pattern(regexp = "[A-Za-z0-9._/\\- ]+", message = "Mã hoàn tiền chứa ký tự không hợp lệ")
    String refundReference
) {
}
