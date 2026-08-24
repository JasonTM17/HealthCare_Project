package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record SpecialtyRequest(
    @NotBlank @Size(max = 160) String name,
    @NotBlank @Size(max = 180) String slug,
    @Size(max = 2000) String description,
    @Size(max = 50) List<@NotBlank @Size(max = 300) String> commonSymptoms,
    @Size(max = 50) List<@NotBlank @Size(max = 300) String> preparationSteps,
    @Size(max = 10_000) String carePathway,
    @Size(max = 10_000) String clinicalOverview,
    @Size(max = 50) List<@Size(max = 500) String> commonConditions,
    @Size(max = 50) List<@Size(max = 500) String> redFlags,
    @Size(max = 50) List<@Size(max = 500) String> preventiveCare,
    @Size(max = 10_000) String whenToSeekCare,
    @Size(max = 50) List<@Size(max = 1_000) String> sourceReferences,
    @Size(max = 50) Map<@Size(max = 80) String, @Size(max = 1_000) String> clinicalMetadata,
    boolean active
) {

    /** Source-compatible constructor for the original four-field contract. */
    public SpecialtyRequest(String name, String slug, String description, boolean active) {
        this(name, slug, description, null, null, null, null, null, null, null,
            null, null, null, active);
    }

    /** Source-compatible constructor for the first rich specialty contract. */
    public SpecialtyRequest(
        String name,
        String slug,
        String description,
        List<String> commonSymptoms,
        List<String> preparationSteps,
        String carePathway,
        boolean active
    ) {
        this(name, slug, description, commonSymptoms, preparationSteps, carePathway,
            null, null, null, null, null, null, null, active);
    }
}
