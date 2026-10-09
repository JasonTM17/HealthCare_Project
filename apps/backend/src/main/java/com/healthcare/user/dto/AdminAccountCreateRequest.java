package com.healthcare.user.dto;

import com.healthcare.auth.security.BcryptInputLength;
import jakarta.validation.constraints.*;
import java.util.Set;
import java.util.UUID;

public record AdminAccountCreateRequest(
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 2, max = 160) String displayName,
    @NotBlank @Size(min = 8, max = 128) @BcryptInputLength
    @Pattern(regexp = "^(?=.*\\p{L})(?=.*\\d).*$") String password,
    @NotEmpty @Size(max = 3) Set<@NotNull @Pattern(regexp = "PATIENT|DOCTOR|ADMIN") String> roles,
    UUID doctorProfileId
) { }
