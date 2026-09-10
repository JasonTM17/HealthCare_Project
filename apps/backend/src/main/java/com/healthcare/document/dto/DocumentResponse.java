package com.healthcare.document.dto;

import com.healthcare.document.entity.DocumentSourceType;
import com.healthcare.document.entity.DocumentStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * API projection of a synthetic document row. It deliberately exposes the
 * template version and hash tail so the patient UI can show honest provenance
 * without implying a digital signature.
 */
public record DocumentResponse(
        UUID id,
        UUID patientId,
        UUID sourceRecordId,
        DocumentSourceType sourceType,
        Long sourceVersion,
        String templateVersion,
        DocumentStatus status,
        String sha256,
        Long byteSize,
        UUID generatedBy,
        OffsetDateTime generatedAt,
        OffsetDateTime revokedAt
) {
}
