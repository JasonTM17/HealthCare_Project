package com.healthcare.document.dto;

import com.healthcare.document.entity.DocumentSourceType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record GenerateDocumentRequest(
        @NotNull DocumentSourceType sourceType,
        @NotNull UUID sourceRecordId
) {
}
