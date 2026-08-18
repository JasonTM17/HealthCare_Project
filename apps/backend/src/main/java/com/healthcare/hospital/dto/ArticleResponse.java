package com.healthcare.hospital.dto;

import java.time.OffsetDateTime;

public record ArticleResponse(
    String id,
    String title,
    String slug,
    String summary,
    String body,
    OffsetDateTime publishedAt
) {
}
