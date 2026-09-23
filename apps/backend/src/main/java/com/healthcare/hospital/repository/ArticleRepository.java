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

    /**
     * True when some other row already owns a slug that only differs in case.
     * The database unique constraint is case-sensitive, so it happily stores
     * {@code tang-huyet} next to {@code Tang-Huyet}; this pre-check keeps new
     * writes from creating that split. Existing rows are untouched.
     */
    boolean existsBySlugIgnoreCaseAndSlugNot(String slug, String excludedSlug);

    /** Rename variant: the row being renamed is excluded by id, not by slug. */
    boolean existsBySlugIgnoreCaseAndSlugNotAndIdNot(
        String slug, String excludedSlug, UUID excludedId);

    /**
     * Fixture-guard pattern. Every public read below carries
     * {@code slug NOT LIKE 'e2e-%'}: a Playwright fixture must never surface on
     * the hospital's public pages, even if a run leaves one behind published
     * (V100 hides what already exists; this keeps new leaks structurally
     * impossible). Admin and doctor-portal queries intentionally do NOT filter
     * the prefix, so authors keep seeing their own fixtures. The derived names
     * are kept as-is on purpose: callers and existing repository stubs bind to
     * them, and the explicit @Query bodies replace method-name derivation while
     * preserving the signature.
     */
    /** Public detail read: only admin/doctor-review-approved articles resolve. */
    @Query("""
        SELECT a FROM Article a
         WHERE a.slug = :slug
           AND a.active = TRUE
           AND a.reviewStatus = :reviewStatus
           AND a.publishedAt <= :publicationCutoff
           AND a.slug NOT LIKE 'e2e-%'
    """)
    Optional<Article> findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
        @org.springframework.data.repository.query.Param("slug") String slug,
        @org.springframework.data.repository.query.Param("reviewStatus") String reviewStatus,
        @org.springframework.data.repository.query.Param("publicationCutoff") OffsetDateTime publicationCutoff);

    @Query("""
        SELECT a FROM Article a
         WHERE a.slug = :slug
           AND a.active = TRUE
           AND a.publishedAt <= :publicationCutoff
           AND a.slug NOT LIKE 'e2e-%'
    """)
    Optional<Article> findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
        @org.springframework.data.repository.query.Param("slug") String slug,
        @org.springframework.data.repository.query.Param("publicationCutoff") OffsetDateTime publicationCutoff);

    /** Public list reads: the APPROVED gate keeps pending doctor submissions out. */
    @Query("""
        SELECT a FROM Article a
         WHERE a.contentKind = :contentKind
           AND a.active = TRUE
           AND a.reviewStatus = :reviewStatus
           AND a.publishedAt <= :publicationCutoff
           AND a.slug NOT LIKE 'e2e-%'
         ORDER BY a.publishedAt DESC
    """)
    Page<Article> findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
        @org.springframework.data.repository.query.Param("contentKind") String contentKind,
        @org.springframework.data.repository.query.Param("reviewStatus") String reviewStatus,
        @org.springframework.data.repository.query.Param("publicationCutoff") OffsetDateTime publicationCutoff,
        Pageable pageable);

    @Query("""
        SELECT a FROM Article a
         WHERE a.active = TRUE
           AND a.publishedAt <= :publicationCutoff
           AND a.slug NOT LIKE 'e2e-%'
         ORDER BY a.publishedAt DESC
    """)
    Page<Article> findByActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
        @org.springframework.data.repository.query.Param("publicationCutoff") OffsetDateTime publicationCutoff,
        Pageable pageable);

    /**
     * Scheduled articles whose appointed time has arrived. The where-clause
     * is deliberately explicit: only an active row that has passed the review
     * gate and has never been published may be promoted by the sweep, so a
     * PENDING or REJECTED draft with a due schedule can never leak out.
     */
    @Query("""
        SELECT a FROM Article a
         WHERE a.publishedAt IS NULL
           AND a.active = TRUE
           AND a.reviewStatus = 'APPROVED'
           AND a.scheduledPublishAt IS NOT NULL
           AND a.scheduledPublishAt <= :dueBefore
         ORDER BY a.scheduledPublishAt ASC
    """)
    java.util.List<Article> findDueScheduledPublications(
        @org.springframework.data.repository.query.Param("dueBefore") OffsetDateTime dueBefore,
        org.springframework.data.domain.Pageable pageable);

    @Query("""
        SELECT a FROM Article a
         WHERE LOWER(a.authorName) = LOWER(:authorName)
            OR (:altName IS NOT NULL AND LOWER(a.authorName) = LOWER(:altName))
            OR (:pureName IS NOT NULL AND :pureName <> '' AND LOWER(a.authorName) LIKE LOWER(CONCAT('%', :pureName, '%')))
         ORDER BY a.publishedAt DESC NULLS LAST, a.updatedAt DESC
    """)
    Page<Article> findByAuthorNames(
        @org.springframework.data.repository.query.Param("authorName") String authorName,
        @org.springframework.data.repository.query.Param("altName") String altName,
        @org.springframework.data.repository.query.Param("pureName") String pureName,
        Pageable pageable);

    @Query("""
        SELECT a FROM Article a
         WHERE (LOWER(a.authorName) = LOWER(:authorName)
            OR (:altName IS NOT NULL AND LOWER(a.authorName) = LOWER(:altName))
            OR (:pureName IS NOT NULL AND :pureName <> '' AND LOWER(a.authorName) LIKE LOWER(CONCAT('%', :pureName, '%'))))
           AND a.contentKind = :contentKind
         ORDER BY a.publishedAt DESC NULLS LAST, a.updatedAt DESC
    """)
    Page<Article> findByAuthorNamesAndContentKind(
        @org.springframework.data.repository.query.Param("authorName") String authorName,
        @org.springframework.data.repository.query.Param("altName") String altName,
        @org.springframework.data.repository.query.Param("pureName") String pureName,
        @org.springframework.data.repository.query.Param("contentKind") String contentKind,
        Pageable pageable);

    /**
     * Author-scoped list for an identified doctor: {@code author_doctor_id}
     * (V93) is the only ownership authority, so two doctors that share a
     * display name can never read each other's rows and a renamed doctor keeps
     * their own list. The legacy {@code findByAuthorNames} text matching stays
     * reserved for rows that predate the backfill and for callers with no
     * doctor identity at all.
     */
    @Query("""
        SELECT a FROM Article a
         WHERE a.authorDoctorId = :authorDoctorId
         ORDER BY a.publishedAt DESC NULLS LAST, a.updatedAt DESC
    """)
    Page<Article> findByAuthorDoctorId(
        @org.springframework.data.repository.query.Param("authorDoctorId") UUID authorDoctorId,
        Pageable pageable);

    /** Content-kind variant of the doctor-id scoped list. */
    @Query("""
        SELECT a FROM Article a
         WHERE a.authorDoctorId = :authorDoctorId
           AND a.contentKind = :contentKind
         ORDER BY a.publishedAt DESC NULLS LAST, a.updatedAt DESC
    """)
    Page<Article> findByAuthorDoctorIdAndContentKind(
        @org.springframework.data.repository.query.Param("authorDoctorId") UUID authorDoctorId,
        @org.springframework.data.repository.query.Param("contentKind") String contentKind,
        Pageable pageable);

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
           AND a.review_status = 'APPROVED'
           AND a.slug NOT LIKE 'e2e-%'
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
           AND a.review_status = 'APPROVED'
           AND a.slug NOT LIKE 'e2e-%'
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
           AND a.review_status = 'APPROVED'
           AND a.slug NOT LIKE 'e2e-%'
           AND h.eligibility_state = 'APPROVED' AND r.state = 'APPROVED'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE' AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        LIMIT 1
        """, nativeQuery = true)
    Optional<Article> findClinicallyEligibleDiseaseGuideBySlug(String slug);
}
