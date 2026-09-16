package com.healthcare.clinical.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;

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

    @Size(max = 20) String icd10Code,
    @Size(max = 255) String icd10Name,

    @NotBlank(message = "Diagnosis is required")
    @Size(max = 2000, message = "Chẩn đoán tối đa 2000 ký tự")
    String diagnosis,

    @Size(max = 2000) String symptomsSummary,
    Integer bloodPressureSystolic,
    Integer bloodPressureDiastolic,
    Integer heartRate,
    BigDecimal temperature,
    BigDecimal weightKg,
    BigDecimal heightCm,
    @Size(max = 3000) String treatmentPlan,
    @Size(max = 2000) String doctorNotes,
    LocalDate followUpDate,

    // Optional immediate electronic prescription
    @Valid List<PrescriptionItemDto> prescriptionItems,
    @Size(max = 2000) String prescriptionAdvice
) {}
