package com.healthcare.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BrowserSessionCreateRequest(
    @NotNull GrantType grantType,

    // Not blank is enforced per-grant in AuthService: PASSWORD and
    // EMAIL_VERIFICATION require it, while the GOOGLE grant derives the
    // caller's identity from the verified ID token instead.
    @Email(message = "Email must be valid")
    @Size(max = 320)
    String email,

    @Size(max = 128)
    String password,

    @Size(max = 32)
    @JsonAlias({"otp", "otpCode", "verificationCode", "token"})
    String code,

    // GIS credential JWT; only meaningful for the GOOGLE grant.
    @JsonAlias({"idToken", "credential"})
    @Size(max = 8192)
    String googleIdToken
) {
    public enum GrantType {
        PASSWORD,
        EMAIL_VERIFICATION,
        GOOGLE
    }
}
