package com.healthcare.clinical.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CreateDiagnosticResultRequest(
    @NotBlank @Size(max = 200) String testName,
    @Size(max = 4000) String result,
    UUID fileId,
    @PastOrPresent OffsetDateTime testDate
) {
}
