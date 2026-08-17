package com.healthcare.clinical.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PrescriptionResponse(
    UUID id,
    String prescriptionCode,
    UUID patientId,
    String patientName,
    UUID doctorId,
    String doctorName,
    String diagnosisSummary,
    String generalAdvice,
    String status,
    List<PrescriptionItemDto> items,
    OffsetDateTime createdAt
) {}
