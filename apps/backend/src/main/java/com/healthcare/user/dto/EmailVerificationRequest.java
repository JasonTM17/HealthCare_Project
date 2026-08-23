package com.healthcare.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmailVerificationRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 320, message = "Email must not exceed 320 characters")
    String email,

    @NotBlank(message = "Verification code is required")
    @Size(max = 32, message = "Verification code is invalid")
    @JsonAlias({"otp", "otpCode", "verificationCode", "token"})
    String code
) {
}
