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
    OffsetDateTime updatedAt,
    /** False for soft-deleted rows kept so their replies do not orphan. */
    boolean active
) {
    public static ArticleCommentResponse from(ArticleComment comment) {
        return from(comment, true);
    }

    public static ArticleCommentResponse from(ArticleComment comment, boolean active) {
        return new ArticleCommentResponse(
            comment.getId(),
            comment.getArticleSlug(),
            comment.getAuthorUserId(),
            comment.getAuthorName(),
            comment.getAuthorRole(),
            comment.getContent(),
            comment.getParentCommentId(),
            comment.getCreatedAt(),
            comment.getUpdatedAt(),
            active
        );
    }

    /** A deleted comment: structure only, no author or content. */
    public static ArticleCommentResponse tombstone(ArticleComment comment) {
        return new ArticleCommentResponse(
            comment.getId(),
            comment.getArticleSlug(),
            null,
            null,
            null,
            "[Bình luận đã xóa]",
            comment.getParentCommentId(),
            comment.getCreatedAt(),
            comment.getUpdatedAt(),
            false
        );
    }
}
