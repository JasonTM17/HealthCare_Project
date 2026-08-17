package com.healthcare.clinical.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateMedicalRecordRequest(
    UUID appointmentId,

    @NotNull(message = "Patient ID is required")
    UUID patientId,

    @NotNull(message = "Doctor ID is required")
    UUID doctorId,

    String icd10Code,
    String icd10Name,

    @NotBlank(message = "Diagnosis is required")
    String diagnosis,

    String symptomsSummary,
    Integer bloodPressureSystolic,
    Integer bloodPressureDiastolic,
    Integer heartRate,
    BigDecimal temperature,
    BigDecimal weightKg,
    BigDecimal heightCm,
    String treatmentPlan,
    String doctorNotes,
    LocalDate followUpDate,

    // Optional immediate electronic prescription
    List<PrescriptionItemDto> prescriptionItems,
    String prescriptionAdvice
) {}
