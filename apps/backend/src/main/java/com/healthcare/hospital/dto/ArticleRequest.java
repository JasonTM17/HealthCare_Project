package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record ArticleRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 220) String slug,
    @Size(max = 500) String summary,
    @Size(max = 8000) String body,
    @Size(max = 120) String category,
    @Size(max = 160) String authorName,
    @jakarta.validation.constraints.Positive @jakarta.validation.constraints.Max(180) Integer readingMinutes,
    @Size(max = 180) String relatedSpecialtySlug,
    @Size(max = 24) @Pattern(regexp = "GENERAL|DISEASE_GUIDE") String contentKind,
    @Size(max = 500) String coverImageUrl,
    @Size(max = 200) String seoTitle,
    @Size(max = 500) String seoDescription,
    @Size(max = 50) List<@Size(max = 300) String> tags,
    OffsetDateTime scheduledPublishAt,
    @jakarta.validation.constraints.Positive Long version,
    // Twenty bounded sections plus the legacy body stay below the immutable
    // 128 KiB clinical snapshot constraint.
    @Valid @Size(max = 20) List<ArticleSectionRequest> sections,
    @Size(max = 12) @Pattern(regexp = "[a-z]{2}(-[A-Z]{2})?") String contentLanguage,
    @Size(max = 32) String audience,
    @Size(max = 50) List<@Size(max = 300) String> topicTags,
    @Size(max = 50) List<@Size(max = 500) String> keyTakeaways,
    @Size(max = 50) List<@Size(max = 500) String> warningSigns,
    @Size(max = 50) List<@Size(max = 500) String> preventionTips,
    @Size(max = 10_000) String whenToSeekCare,
    @Size(max = 50) List<@Size(max = 1_000) String> sourceReferences,
    @Size(max = 50) Map<@Size(max = 80) String, @Size(max = 1_000) String> clinicalMetadata,
    @Size(max = 2_000) String clinicalDisclaimer,
    Boolean featured,
    boolean active
) {

    /** Source-compatible constructor for callers that only edit core fields. */
    public ArticleRequest(
        String title,
        String slug,
        String summary,
        String body,
        boolean active
    ) {
        this(title, slug, summary, body,
            null, null, null, null, null, null, null,
            null, null, null, null, null, null,
            null, null, null, null, null, null, null, null,
            null, null, active);
    }

    /** Source-compatible constructor for the rich-content mapping slice. */
    public ArticleRequest(
        String title,
        String slug,
        String summary,
        String body,
        String category,
        String authorName,
        Integer readingMinutes,
        String relatedSpecialtySlug,
        List<ArticleSectionRequest> sections,
        boolean active
    ) {
        this(title, slug, summary, body, category, authorName, readingMinutes,
            relatedSpecialtySlug,
            null, null, null, null, null, null, null,
            sections,
            null, null, null, null, null, null, null, null, null, null,
            false, active);
    }

    @AssertTrue(message = "Bài viết active cần có tóm tắt và nội dung.")
    public boolean hasPublishedContent() {
        return !active
            || (summary != null && !summary.isBlank() && body != null && !body.isBlank());
    }
}
