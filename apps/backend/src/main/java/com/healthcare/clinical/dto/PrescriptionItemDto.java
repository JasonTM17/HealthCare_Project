package com.healthcare.clinical.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record PrescriptionItemDto(
    @NotBlank(message = "Medication name is required")
    String medicationName,

    String activeIngredient,

    @NotBlank(message = "Dosage is required")
    String dosage,

    String unit,

    @NotBlank(message = "Frequency is required")
    String frequency,

    @Min(1)
    int durationDays,

    @Min(1)
    int totalQuantity,

    String usageNote
) {}
