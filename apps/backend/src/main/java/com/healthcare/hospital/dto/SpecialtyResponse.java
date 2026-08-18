package com.healthcare.hospital.dto;

import java.util.List;

public record SpecialtyResponse(
    String id,
    String name,
    String slug,
    String description,
    List<String> commonSymptoms,
    List<String> preparationSteps,
    String carePathway,
    List<DoctorSummaryResponse> relatedDoctors
) {
}
