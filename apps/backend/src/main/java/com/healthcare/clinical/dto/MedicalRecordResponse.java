package com.healthcare.clinical.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record MedicalRecordResponse(
    UUID id,
    UUID appointmentId,
    String bookingCode,
    UUID patientId,
    String patientName,
    String patientPhone,
    UUID doctorId,
    String doctorName,
    String doctorTitle,
    String icd10Code,
    String icd10Name,
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
    List<PrescriptionResponse> prescriptions,
    OffsetDateTime createdAt
) {}
