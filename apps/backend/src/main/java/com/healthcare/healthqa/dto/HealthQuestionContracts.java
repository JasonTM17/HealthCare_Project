package com.healthcare.healthqa.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public final class HealthQuestionContracts {
    private HealthQuestionContracts() {}
    public record CreateRequest(@NotBlank @Size(max = 180) String topicSlug,
                                @NotBlank @Size(max = 4000) String question,
                                @NotBlank @Size(min = 3, max = 80) String publicAlias) {}
    public record ModerationRequest(@NotBlank String decision, @Size(max = 32) String reasonCode) {}
    public record AnswerRequest(@NotBlank @Size(max = 4000) String answer) {}
    public record DecisionRequest(@NotBlank String decision, @Size(max = 32) String reasonCode) {}
    public record ReportRequest(@NotBlank @Size(max = 32) String reasonCode) {}
    public record ReportDecisionRequest(@NotBlank @Size(max = 24) String status,
                                        @Size(max = 24) String resolutionCode) {}
    public record ReportSummary(UUID id, UUID questionId, String reasonCode, String status,
                                OffsetDateTime createdAt, OffsetDateTime handledAt,
                                String resolutionCode) {}
    public record Summary(UUID id, String topicSlug, String question, String publicAlias, String status,
                          OffsetDateTime createdAt, String answer, String answerStatus) {}
}
