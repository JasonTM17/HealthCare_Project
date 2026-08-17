package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FaqRequest(
    @NotBlank @Size(max = 500) String question,
    @NotBlank @Size(max = 4000) String answer,
    boolean active
) {
}
