package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequest(
    @NotBlank @Size(max = 160) String name,
    @NotBlank @Size(max = 180) String slug,
    @Size(max = 2000) String description,
    boolean active
) {
}
