package com.healthcare.hospital.dto;

public record DoctorResponse(
    String id,
    String fullName,
    String slug,
    String bio,
    String photoUrl,
    String specialtyName,
    String branchId
) {
}
