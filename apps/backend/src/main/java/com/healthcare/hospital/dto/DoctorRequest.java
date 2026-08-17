package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record DoctorRequest(
    @NotBlank @Size(max = 160) String fullName,
    @NotBlank @Size(max = 180) String slug,
    @Size(max = 4000) String bio,
    @Size(max = 500) String photoUrl,
    boolean active,
    UUID userId
) {
}
