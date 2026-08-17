package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ArticleRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 220) String slug,
    @Size(max = 500) String summary,
    @Size(max = 8000) String body,
    boolean active
) {
}
