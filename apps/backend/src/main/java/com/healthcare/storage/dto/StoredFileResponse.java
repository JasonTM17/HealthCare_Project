package com.healthcare.storage.dto;

import com.healthcare.storage.entity.StoredFile;
import com.healthcare.storage.entity.StoredFilePurpose;

import java.time.OffsetDateTime;
import java.util.UUID;

public record StoredFileResponse(
    UUID id,
    String objectName,
    UUID patientId,
    String originalFilename,
    String contentType,
    long sizeBytes,
    StoredFilePurpose purpose,
    String downloadUrl,
    OffsetDateTime createdAt
) {
    public static StoredFileResponse from(StoredFile file) {
        return new StoredFileResponse(
            file.getId(),
            file.getObjectKey(),
            file.getPatient() == null ? null : file.getPatient().getId(),
            file.getOriginalFilename(),
            file.getContentType(),
            file.getSizeBytes(),
            file.getPurpose(),
            "/api/v1/files/" + file.getObjectKey(),
            file.getCreatedAt()
        );
    }
}
