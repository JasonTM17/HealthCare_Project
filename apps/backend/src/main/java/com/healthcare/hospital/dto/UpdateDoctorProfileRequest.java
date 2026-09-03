package com.healthcare.hospital.dto;

import jakarta.validation.constraints.Size;

public record UpdateDoctorProfileRequest(
    @Size(max = 4000) String bio,
    String achievements,
    @Size(max = 500) String photoUrl
) {
}
