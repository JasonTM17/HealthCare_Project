package com.healthcare.ai.controller;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class ClinicalReviewContracts {

    private ClinicalReviewContracts() { }

    public record SubmissionRequest(
        @NotNull @Positive Long revision,
        @NotBlank @Size(min = 64, max = 64) String contentHash
    ) { }

    public record DecisionRequest(
        @NotBlank String decision,
        @Size(max = 2_000) String reason
    ) { }
}
