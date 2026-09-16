package com.healthcare.clinical.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DiagnosticOrderResponse(
    UUID id,
    UUID patientId,
    String patientName,
    UUID doctorId,
    String doctorName,
    UUID appointmentId,
    String testName,
    String notes,
    String status,
    OffsetDateTime createdAt
) {
}
