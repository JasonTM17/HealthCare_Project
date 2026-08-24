package com.healthcare.hospital.dto;

import java.time.OffsetDateTime;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;

public record ArticleResponse(
    String id,
    String title,
    String slug,
    String summary,
    String body,
    OffsetDateTime publishedAt,
    String category,
    String authorName,
    Integer readingMinutes,
    String relatedSpecialtySlug,
    List<ArticleSectionResponse> sections,
    String contentKind,
    String coverImageUrl,
    String seoTitle,
    String seoDescription,
    JsonNode tags,
    OffsetDateTime updatedAt,
    Long version,
    String contentLanguage,
    String audience,
    JsonNode topicTags,
    JsonNode keyTakeaways,
    JsonNode warningSigns,
    JsonNode preventionTips,
    String whenToSeekCare,
    JsonNode sourceReferences,
    JsonNode clinicalMetadata,
    String clinicalDisclaimer,
    boolean featured
) {
}
