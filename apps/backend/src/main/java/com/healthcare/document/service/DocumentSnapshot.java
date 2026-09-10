package com.healthcare.document.service;

import com.healthcare.document.entity.DocumentSourceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Immutable snapshot of the source clinical record at document generation time
 * (ADR-005). Only approved D-03 fields enter the snapshot; the renderer output
 * is a pure function of this record, so identical snapshots must produce
 * byte-identical PDFs.
 */
public record DocumentSnapshot(
        DocumentSourceType sourceType,
        UUID sourceRecordId,
        long sourceVersion,
        String templateVersion,
        String patientName,
        String patientPhone,
        String doctorName,
        OffsetDateTime sourceFinalizedAt,
        VisitSummaryPayload visitSummary,
        PrescriptionPayload prescription
) {

    /** Fields for the synthetic visit summary (bản tổng kết lần khám). */
    public record VisitSummaryPayload(
            String bookingCode,
            OffsetDateTime visitDate,
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
            LocalDate followUpDate
    ) {
    }

    /** Fields for the synthetic prescription (đơn thuốc). */
    public record PrescriptionPayload(
            String prescriptionCode,
            String diagnosisSummary,
            String generalAdvice,
            String status,
            List<PrescriptionItemSnapshot> items
    ) {
    }

    public record PrescriptionItemSnapshot(
            String medicationName,
            String activeIngredient,
            String dosage,
            String unit,
            String frequency,
            Integer durationDays,
            Integer totalQuantity,
            String usageNote
    ) {
    }
}
