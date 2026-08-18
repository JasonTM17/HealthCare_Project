package com.healthcare.hospital.dto;

public record DoctorSummaryResponse(
    String id,
    String fullName,
    String slug,
    String photoUrl,
    String specialtyName,
    String branchId
) {
}
