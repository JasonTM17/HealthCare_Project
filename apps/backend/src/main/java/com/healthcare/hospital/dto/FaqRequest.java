package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.UUID;

public record FaqRequest(
    @NotBlank @Size(max = 500) String question,
    @NotBlank @Size(max = 4000) String answer,
    @Size(max = 120) String category,
    @Size(max = 180) String topicSlug,
    UUID originQuestionId,
    @Size(max = 180) String relatedSpecialtySlug,
    @Size(max = 50) List<@Size(max = 300) String> topicTags,
    Boolean published,
    @Positive Long version,
    boolean active
) {

    public FaqRequest(String question, String answer, boolean active) {
        this(question, answer, null, null, null, null, null, null, null, active);
    }
}
