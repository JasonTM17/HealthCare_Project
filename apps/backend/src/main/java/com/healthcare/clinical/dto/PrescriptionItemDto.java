package com.healthcare.clinical.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PrescriptionItemDto(
    @NotBlank(message = "Medication name is required")
    @Size(max = 255) String medicationName,

    @Size(max = 255) String activeIngredient,

    @NotBlank(message = "Dosage is required")
    @Size(max = 100) String dosage,

    @Size(max = 50) String unit,

    @NotBlank(message = "Frequency is required")
    @Size(max = 150) String frequency,

    @Min(1)
    int durationDays,

    @Min(1)
    int totalQuantity,

    @Size(max = 500) String usageNote
) {}
