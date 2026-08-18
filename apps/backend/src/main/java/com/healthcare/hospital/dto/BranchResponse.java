package com.healthcare.hospital.dto;

import java.util.List;

public record BranchResponse(
    String id,
    String name,
    String slug,
    String address,
    String phone,
    String workingHours,
    String emergencyHotline,
    String mapUrl,
    List<String> amenities,
    List<DoctorSummaryResponse> doctors
) {
}
