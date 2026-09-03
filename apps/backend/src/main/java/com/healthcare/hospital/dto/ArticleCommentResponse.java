package com.healthcare.hospital.dto;

import com.healthcare.hospital.entity.ArticleComment;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ArticleCommentResponse(
    UUID id,
    String articleSlug,
    UUID authorUserId,
    String authorName,
    String authorRole,
    String content,
    UUID parentCommentId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static ArticleCommentResponse from(ArticleComment comment) {
        return new ArticleCommentResponse(
            comment.getId(),
            comment.getArticleSlug(),
            comment.getAuthorUserId(),
            comment.getAuthorName(),
            comment.getAuthorRole(),
            comment.getContent(),
            comment.getParentCommentId(),
            comment.getCreatedAt(),
            comment.getUpdatedAt()
        );
    }
}
