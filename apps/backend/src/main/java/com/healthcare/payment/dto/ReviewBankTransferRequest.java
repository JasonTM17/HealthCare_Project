package com.healthcare.payment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewBankTransferRequest(
    @NotNull Decision decision,
    @Size(max = 500) String reason
) {
    public enum Decision { VERIFY, REJECT }
}
