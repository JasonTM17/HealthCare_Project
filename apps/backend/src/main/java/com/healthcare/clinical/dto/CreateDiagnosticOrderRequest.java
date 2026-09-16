package com.healthcare.clinical.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateDiagnosticOrderRequest(
    @NotNull(message = "Patient ID is required")
    UUID patientId,

    @NotBlank(message = "Test name is required")
    @Size(max = 200) String testName,

    @Size(max = 1000) String notes,

    UUID appointmentId
) {
}
