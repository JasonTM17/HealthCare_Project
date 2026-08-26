package com.healthcare.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BrowserSessionCreateRequest(
    @NotNull GrantType grantType,

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 320)
    String email,

    @Size(max = 128)
    String password,

    @Size(max = 32)
    @JsonAlias({"otp", "otpCode", "verificationCode", "token"})
    String code
) {
    public enum GrantType {
        PASSWORD,
        EMAIL_VERIFICATION
    }
}
