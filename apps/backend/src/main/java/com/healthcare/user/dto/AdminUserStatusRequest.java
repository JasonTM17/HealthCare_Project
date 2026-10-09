package com.healthcare.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AdminUserStatusRequest(
    @NotBlank
    @Pattern(regexp = "ACTIVE|DISABLED")
    String status
) {}
