package com.healthcare.hospital.dto;

import jakarta.validation.constraints.Size;

/** Editable, bounded section of a patient-facing health article. */
public record ArticleSectionRequest(
    @Size(max = 160) String heading,
    @Size(max = 4_000) String body
) {
}
