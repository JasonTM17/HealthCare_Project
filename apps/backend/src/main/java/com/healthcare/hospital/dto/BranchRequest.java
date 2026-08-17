package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BranchRequest(
    @NotBlank @Size(max = 160) String name,
    @NotBlank @Size(max = 180) String slug,
    @NotBlank @Size(max = 500) String address,
    @Size(max = 50) String phone,
    boolean active
) {
}
