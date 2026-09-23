package com.healthcare.hospital.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.ArticleSectionRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class AdminArticleService {

    private final ArticleRepository articleRepository;
    private final com.healthcare.ai.service.AiClinicalContentRevisionService revisionService;

    public AdminArticleService(ArticleRepository articleRepository) {
        this(articleRepository, null);
    }

    @Autowired
    public AdminArticleService(
            ArticleRepository articleRepository,
            com.healthcare.ai.service.AiClinicalContentRevisionService revisionService) {
        this.articleRepository = articleRepository;
        this.revisionService = revisionService;
    }

    @Transactional(readOnly = true)
    public Page<Article> list(Pageable pageable) {
        return articleRepository.findAll(pageable);
    }

    @Transactional
    public Article create(ArticleRequest request) {
        return create(request, null);
    }

    @Transactional
    public Article create(ArticleRequest request, UserDetails actor) {
        return create(request, actor, null);
    }

    /**
     * Doctor-portal create.  The doctor id is resolved by the caller (the
     * authenticated doctor principal), never taken from the request payload,
     * so a client cannot forge authorship.  Passing {@code null} keeps the
     * plain admin create behaviour unchanged.
     */
    @Transactional
    public Article create(ArticleRequest request, UserDetails actor, UUID authorDoctorId) {
        if (articleRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Article slug already exists: " + request.slug());
        }
        if (articleRepository.existsBySlugIgnoreCaseAndSlugNot(request.slug(), request.slug())) {
            throw new DuplicateResourceException("Article slug already exists: " + request.slug());
        }
        Article article = new Article();
        article.setTitle(request.title());
        article.setSlug(request.slug());
        article.setSummary(request.summary());
        article.setBody(ArticleBodySanitizer.sanitize(request.body()));
        applyRichFields(article, request);
        article.setActive(request.active());
        if (authorDoctorId != null) {
            article.setAuthorDoctorId(authorDoctorId);
        }
        applyReviewGate(article, authorDoctorId != null);
        applyPublicationState(article, request, true);
        Article saved = saveArticle(article);
        if (revisionService != null) revisionService.recordArticle(saved, actor);
        return saved;
    }

    @Transactional
    public Article update(String slug, ArticleRequest request) {
        return update(slug, request, null);
    }

    @Transactional
    public Article update(String slug, ArticleRequest request, UserDetails actor) {
        return update(slug, request, actor, null);
    }

    /**
     * Doctor-portal update.  A non-null {@code authorDoctorId} is the verified
     * caller from the doctor controller: writing it here atomically binds the
     * article to the doctor and self-heals legacy rows whose
     * {@code author_doctor_id} was still NULL.  The admin path passes
     * {@code null} and must never clobber an existing binding.
     */
    @Transactional
    public Article update(String slug, ArticleRequest request, UserDetails actor, UUID authorDoctorId) {
        Article article = articleRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Article not found: " + slug));
        if (request.version() != null && !request.version().equals(article.getVersion())) {
            throw new BusinessException(
                409,
                ErrorCodes.AI_CONTENT_REVISION_STALE,
                "Article version is stale; reload before saving"
            );
        }
        if (!slug.equals(request.slug())) {
            if (articleRepository.findBySlug(request.slug()).isPresent()) {
                throw new DuplicateResourceException("Article slug already exists: " + request.slug());
            }
            // The database constraint is case-sensitive, so a rename that only
            // changes case would leave two articles sharing one URL when
            // lower-cased. Reject renames that collide case-insensitively with
            // any other row; the row's own slug is excluded by id so a legacy
            // mixed-case slug can still be cleaned up. Untouched slugs are
            // never re-checked: existing data must stay editable.
            if (articleRepository.existsBySlugIgnoreCaseAndSlugNotAndIdNot(
                    request.slug(), request.slug(), article.getId())) {
                throw new DuplicateResourceException("Article slug already exists: " + request.slug());
            }
        }
        article.setTitle(request.title());
        article.setSlug(request.slug());
        article.setSummary(request.summary());
        article.setBody(ArticleBodySanitizer.sanitize(request.body()));
        applyRichFields(article, request);
        article.setActive(request.active());
        if (authorDoctorId != null) {
            article.setAuthorDoctorId(authorDoctorId);
        }
        applyReviewGate(article, authorDoctorId != null);
        applyPublicationState(article, request, false);
        Article saved = saveArticle(article);
        if (revisionService != null) revisionService.recordArticle(saved, actor);
        return saved;
    }

    @Transactional
    public void delete(String slug) {
        delete(slug, null);
    }

    @Transactional
    public void delete(String slug, UserDetails actor) {
        Article article = articleRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Article not found: " + slug));
        if (revisionService != null) revisionService.recordArticleDeletion(article, actor);
        articleRepository.delete(article);
    }

    /** The only review decisions the gate accepts; anything else is a client bug. */
    public static final String REVIEW_APPROVED = "APPROVED";
    public static final String REVIEW_REJECTED = "REJECTED";
    public static final String REVIEW_PENDING = "PENDING";

    /**
     * Admin decision on a doctor submission. Approving publishes to the public
     * catalog (the public queries filter on APPROVED); rejecting withdraws the
     * article from the catalog while keeping it visible to the author with the
     * recorded reason. Admin-written articles never pass through here: they
     * are born APPROVED and admin edits do not re-open the gate.
     */
    @Transactional
    public Article review(String slug, String decision, String reason, UserDetails reviewer) {
        Article article = articleRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Article not found: " + slug));
        String normalized = decision == null ? "" : decision.trim().toUpperCase(java.util.Locale.ROOT);
        if (!REVIEW_APPROVED.equals(normalized) && !REVIEW_REJECTED.equals(normalized)) {
            throw new com.healthcare.exception.BusinessException(
                400, ErrorCodes.VALIDATION_ERROR, "Quyết định duyệt bài chỉ có thể là APPROVED hoặc REJECTED");
        }
        if (REVIEW_REJECTED.equals(normalized) && article.getAuthorDoctorId() == null) {
            throw new com.healthcare.exception.BusinessException(
                400, ErrorCodes.VALIDATION_ERROR,
                "Chỉ bài do bác sĩ gửi mới có thể bị từ chối; hãy gỡ xuất bản trực tiếp nếu cần");
        }
        article.setReviewStatus(normalized);
        // The reason travels on the public article projection, so it is kept only
        // for a rejection, where the author is the intended reader. An approval
        // note must not reach an anonymous reader.
        article.setReviewReason(REVIEW_REJECTED.equals(normalized)
            && reason != null && !reason.isBlank() ? reason.strip() : null);
        article.setReviewDecidedAt(OffsetDateTime.now());
        article.setReviewDecidedBy(resolveReviewerId(reviewer));
        return articleRepository.save(article);
    }

    private UUID resolveReviewerId(UserDetails reviewer) {
        if (reviewer instanceof com.healthcare.security.HealthcareUserPrincipal principal) {
            return principal.getUserId();
        }
        return null;
    }

    /**
     * The doctor submission gate. Every create or edit by a doctor re-enters
     * review: an edited APPROVED body no longer matches what the reviewer saw,
     * and editing a REJECTED article is precisely the re-submission the
     * rejection asked for. The admin path never demotes an existing decision.
     */
    private void applyReviewGate(Article article, boolean doctorSubmission) {
        if (!doctorSubmission) {
            return;
        }
        article.setReviewStatus(REVIEW_PENDING);
        article.setReviewReason(null);
        article.setReviewDecidedAt(null);
        article.setReviewDecidedBy(null);
    }

    private void applyRichFields(Article article, ArticleRequest request) {
        // Null means the legacy payload omitted the additive field.  Preserve
        // an existing value on update so older admin clients cannot erase
        // governed article metadata accidentally.
        if (request.category() != null) article.setCategory(request.category().strip());
        if (request.authorName() != null) article.setAuthorName(request.authorName().strip());
        if (request.readingMinutes() != null) article.setReadingMinutes(request.readingMinutes());
        if (request.relatedSpecialtySlug() != null) {
            article.setRelatedSpecialtySlug(request.relatedSpecialtySlug().strip());
        }
        if (request.contentKind() != null) {
            article.setContentKind(request.contentKind().strip().toUpperCase(java.util.Locale.ROOT));
        }
        if (request.coverImageUrl() != null) article.setCoverImageUrl(trimToNull(request.coverImageUrl()));
        if (request.seoTitle() != null) article.setSeoTitle(trimToNull(request.seoTitle()));
        if (request.seoDescription() != null) article.setSeoDescription(trimToNull(request.seoDescription()));
        if (request.tags() != null) article.setTags(HospitalJsonMapper.stringArray(request.tags()));
        // The rich admin editor sends null when a schedule is deliberately
        // cleared.  Treat it as an explicit value so an article cannot remain
        // silently scheduled after the editor shows an empty field.
        article.setScheduledPublishAt(request.scheduledPublishAt());
        // Sections come from the author when the editor supplied them; the
        // admin article form has a real section builder (heading + body per
        // row, with duplicate/reorder), and silently replacing that work with
        // a body-derived array made the editor a lie.
        // Derivation is the fallback for body-only authors, so the public
        // disease-guide pages never render an empty outline.
        if (hasAuthorSections(request.sections())) {
            article.setSections(HospitalJsonMapper.articleSections(request.sections()));
        } else {
            article.setSections(ArticleSectionsDeriver.derive(article.getBody()));
        }
        if (request.contentLanguage() != null) article.setContentLanguage(request.contentLanguage().strip());
        if (request.audience() != null) article.setAudience(request.audience().strip().toUpperCase(java.util.Locale.ROOT));
        if (request.topicTags() != null) article.setTopicTags(HospitalJsonMapper.stringArray(request.topicTags()));
        if (request.keyTakeaways() != null) article.setKeyTakeaways(HospitalJsonMapper.stringArray(request.keyTakeaways()));
        if (request.warningSigns() != null) article.setWarningSigns(HospitalJsonMapper.stringArray(request.warningSigns()));
        if (request.preventionTips() != null) article.setPreventionTips(HospitalJsonMapper.stringArray(request.preventionTips()));
        if (request.whenToSeekCare() != null) article.setWhenToSeekCare(request.whenToSeekCare().strip());
        if (request.sourceReferences() != null) article.setSourceReferences(HospitalJsonMapper.stringArray(request.sourceReferences()));
        if (request.clinicalMetadata() != null) article.setClinicalMetadata(HospitalJsonMapper.stringObject(request.clinicalMetadata()));
        if (request.clinicalDisclaimer() != null) article.setClinicalDisclaimer(request.clinicalDisclaimer().strip());
        if (request.featured() != null) article.setFeatured(request.featured());
    }

    /**
     * The read-before-write slug check is only an early UX failure.  The
     * database unique constraint remains the authority when two admins submit
     * the same slug concurrently.  Translate only that known article-slug
     * collision; unrelated integrity failures must retain their original
     * error path instead of being hidden as a duplicate article.
     */
    private Article saveArticle(Article article) {
        try {
            return articleRepository.saveAndFlush(article);
        } catch (DataIntegrityViolationException failure) {
            if (isArticleSlugConflict(failure)) {
                throw new DuplicateResourceException(
                    ErrorCodes.CONFLICT,
                    "Article slug already exists"
                );
            }
            throw failure;
        }
    }

    private boolean isArticleSlugConflict(Throwable failure) {
        Throwable current = failure;
        while (current != null) {
            if (current instanceof ConstraintViolationException constraint) {
                String name = constraint.getConstraintName();
                if (name != null && name.equalsIgnoreCase("articles_slug_key")) {
                    return true;
                }
            }
            if (current instanceof SQLException sqlException
                    && "23505".equals(sqlException.getSQLState())
                    && mentionsArticleSlug(current.getMessage())) {
                return true;
            }
            if (mentionsArticleSlug(current.getMessage())
                    && containsUniqueMarker(current.getMessage())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean mentionsArticleSlug(String message) {
        if (message == null) return false;
        String normalized = message.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("articles_slug_key")
            || (normalized.contains("articles") && normalized.contains("slug"));
    }

    private boolean containsUniqueMarker(String message) {
        if (message == null) return false;
        String normalized = message.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("duplicate")
            || normalized.contains("unique")
            || normalized.contains("violates");
    }

    private void applyPublicationState(Article article, ArticleRequest request, boolean creating) {
        if (!request.active()) {
            article.setPublishedAt(null);
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime scheduled = request.scheduledPublishAt() == null
            ? article.getScheduledPublishAt() : request.scheduledPublishAt();
        if (scheduled != null && scheduled.isAfter(now)) {
            article.setPublishedAt(null);
            return;
        }
        if (creating || article.getPublishedAt() == null) article.setPublishedAt(now);
    }

    /**
     * True when the editor submitted sections the author actually wrote. A
     * heading with no body is scaffolding, not content: the medical blueprint
     * presets in the admin editor create exactly that, and treating it as
     * authored would publish an empty outline over the real article prose.
     */
    private boolean hasAuthorSections(java.util.List<ArticleSectionRequest> sections) {
        if (sections == null) return false;
        return sections.stream().anyMatch(section -> section != null
                && section.body() != null && !section.body().isBlank());
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
