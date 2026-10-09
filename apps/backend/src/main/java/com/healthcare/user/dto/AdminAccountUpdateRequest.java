package com.healthcare.user.dto;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

public record AdminAccountUpdateRequest(
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 2, max = 160) String displayName,
    @NotBlank @Pattern(regexp = "ACTIVE|DISABLED") String status,
    @NotEmpty @Size(max = 3) Set<@NotNull @Pattern(regexp = "PATIENT|DOCTOR|ADMIN") String> roles,
    UUID doctorProfileId, boolean unlinkDoctorProfile,
    @NotNull @PositiveOrZero Long expectedVersion,
    @NotNull OffsetDateTime expectedUpdatedAt
) { }
