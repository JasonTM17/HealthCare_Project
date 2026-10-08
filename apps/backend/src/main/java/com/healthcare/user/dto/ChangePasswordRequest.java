package com.healthcare.user.dto;

import com.healthcare.auth.security.BcryptInputLength;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank String currentPassword,
    @NotBlank @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    @BcryptInputLength
    @Pattern(
        regexp = "^(?=.*\\p{L})(?=.*\\d).*$",
        message = "Password must contain at least one letter and one digit"
    ) String newPassword
) {
}
