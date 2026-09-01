package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Article;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;
import java.time.OffsetDateTime;

@Repository
public interface ArticleRepository extends JpaRepository<Article, UUID> {
    Optional<Article> findBySlug(String slug);

    Optional<Article> findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
        String slug, OffsetDateTime publicationCutoff);

    Page<Article> findByActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
        OffsetDateTime publicationCutoff, Pageable pageable);

    Page<Article> findByContentKindAndActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
        String contentKind, OffsetDateTime publicationCutoff, Pageable pageable);

    /** Disease guides are public only while their current clinical review is eligible. */
    @Query(value = """
        SELECT DISTINCT a.*
          FROM articles a
          JOIN ai_content_review_heads h
            ON h.source_type = 'ARTICLE' AND h.source_id = a.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision
           AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer_user ON reviewer_user.id = r.reviewed_by
          JOIN user_roles reviewer_link ON reviewer_link.user_id = reviewer_user.id
          JOIN roles reviewer_role ON reviewer_role.id = reviewer_link.role_id
          JOIN doctors reviewer_doctor ON reviewer_doctor.user_id = reviewer_user.id
         WHERE a.content_kind = 'DISEASE_GUIDE'
           AND a.active = TRUE AND a.published_at <= CURRENT_TIMESTAMP
           AND h.eligibility_state = 'APPROVED'
           AND r.state = 'APPROVED'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE'
           AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        ORDER BY a.published_at DESC
        """,
        countQuery = """
        SELECT COUNT(DISTINCT a.id)
          FROM articles a
          JOIN ai_content_review_heads h
            ON h.source_type = 'ARTICLE' AND h.source_id = a.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision
           AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer_user ON reviewer_user.id = r.reviewed_by
          JOIN user_roles reviewer_link ON reviewer_link.user_id = reviewer_user.id
          JOIN roles reviewer_role ON reviewer_role.id = reviewer_link.role_id
          JOIN doctors reviewer_doctor ON reviewer_doctor.user_id = reviewer_user.id
         WHERE a.content_kind = 'DISEASE_GUIDE'
           AND a.active = TRUE AND a.published_at <= CURRENT_TIMESTAMP
           AND h.eligibility_state = 'APPROVED' AND r.state = 'APPROVED'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE' AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        """, nativeQuery = true)
    Page<Article> findClinicallyEligibleDiseaseGuides(Pageable pageable);

    @Query(value = """
        SELECT DISTINCT a.*
          FROM articles a
          JOIN ai_content_review_heads h
            ON h.source_type = 'ARTICLE' AND h.source_id = a.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer_user ON reviewer_user.id = r.reviewed_by
          JOIN user_roles reviewer_link ON reviewer_link.user_id = reviewer_user.id
          JOIN roles reviewer_role ON reviewer_role.id = reviewer_link.role_id
          JOIN doctors reviewer_doctor ON reviewer_doctor.user_id = reviewer_user.id
         WHERE a.slug = :slug AND a.content_kind = 'DISEASE_GUIDE'
           AND a.active = TRUE AND a.published_at <= CURRENT_TIMESTAMP
           AND h.eligibility_state = 'APPROVED' AND r.state = 'APPROVED'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE' AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        LIMIT 1
        """, nativeQuery = true)
    Optional<Article> findClinicallyEligibleDiseaseGuideBySlug(String slug);
}
