package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.ArticleComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ArticleCommentRepository extends JpaRepository<ArticleComment, UUID> {
    List<ArticleComment> findByArticleSlugAndActiveTrueOrderByCreatedAtAsc(String articleSlug);
    List<ArticleComment> findByAuthorUserIdOrderByCreatedAtDesc(UUID authorUserId);
    long countByArticleSlugAndActiveTrue(String articleSlug);
}
