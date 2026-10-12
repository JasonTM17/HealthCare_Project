package com.healthcare.user.dto;

import com.healthcare.auth.security.BcryptInputLength;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;

public record AdminAccountPasswordRequest(
    @NotBlank @Size(min = 8, max = 128) @BcryptInputLength
    @Pattern(regexp = "^(?=.*\\p{L})(?=.*[0-9])[^\\r\\n\\u2028\\u2029]*$") String newPassword,
    @NotNull @PositiveOrZero Long expectedVersion,
    @NotNull OffsetDateTime expectedUpdatedAt
) {
    @Override public String toString() { return "AdminAccountPasswordRequest[redacted]"; }
}
