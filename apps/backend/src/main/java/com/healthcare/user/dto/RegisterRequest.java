package com.healthcare.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 320, message = "Email must not exceed 320 characters")
    String email,

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).*$",
        message = "Password must contain at least one lowercase, uppercase, digit, and special character"
    )
    String password,

    @NotBlank(message = "Display name is required")
    @Size(min = 2, max = 160, message = "Display name must be between 2 and 160 characters")
    String displayName,

    @Size(max = 20, message = "Phone must not exceed 20 characters")
    @Pattern(
        regexp = "^[+0-9() .-]*$",
        message = "Phone number is invalid"
    )
    String phone
) {
}
