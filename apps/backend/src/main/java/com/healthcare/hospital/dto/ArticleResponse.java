package com.healthcare.hospital.dto;

import java.time.OffsetDateTime;
import java.util.List;

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
    List<ArticleSectionResponse> sections
) {
}
