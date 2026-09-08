package com.healthcare.healthqa.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public final class HealthQuestionContracts {
    private HealthQuestionContracts() {}
    public record CreateRequest(@NotBlank @Size(max = 180) String topicSlug,
                                @NotBlank @Size(max = 4000) String question,
                                // Mirrors ck_health_questions_public_alias: the alias is
                                // displayed publicly, so it stays ASCII-safe. Without this
                                // pattern a Vietnamese-diacritic alias passes bean validation
                                // and dies as an opaque integrity-violation 409. \z (not $)
                                // because Java $ also matches before a trailing newline
                                // while PostgreSQL $ does not.
                                @NotBlank @Size(min = 3, max = 80)
                                @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9 _-]{2,79}\\z",
                                        message = "Biệt danh chỉ gồm chữ không dấu, số, khoảng trắng, gạch nối (3-80 ký tự)")
                                String publicAlias) {}
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
