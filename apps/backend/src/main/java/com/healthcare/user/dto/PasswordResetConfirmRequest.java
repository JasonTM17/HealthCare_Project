package com.healthcare.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 320, message = "Email must not exceed 320 characters")
    String email,

    @NotBlank(message = "Reset code is required")
    @Size(max = 128, message = "Reset code is invalid")
    @JsonAlias({"code", "otp", "otpCode", "verificationCode", "resetToken"})
    String token,

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).*$",
        message = "Password must contain at least one lowercase, uppercase, digit, and special character"
    )
    @JsonAlias({"newPassword"})
    String password
) {
}
