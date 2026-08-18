package com.healthcare.clinical.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DiagnosticResultResponse(
        UUID id,
        UUID patientId,
        String patientName,
        UUID doctorId,
        String doctorName,
        String testName,
        String result,
        UUID fileId,
        String fileUrl,
        OffsetDateTime testDate
) {
}
