package com.healthcare.hospital.service;

import com.healthcare.common.SafePageRequests;
import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Set;

@Service
public class ArticleService {

    private static final Set<String> ALLOWED_SORT_PROPERTIES =
        Set.of("id", "title", "slug", "category", "readingMinutes", "contentKind", "publishedAt", "updatedAt");

    private final ArticleRepository articleRepository;

    public ArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    public Page<ArticleResponse> listPublished(Pageable pageable) {
        // General articles remain a public operational catalog. Disease guides
        // are exposed through the explicit content-kind path below so an
        // unapproved/expired clinical source can never leak into the generic
        // feed or receive the doctor-approved trust label. The review gate
        // keeps a doctor submission that is still pending invisible here.
        return articleRepository.findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                "GENERAL", "APPROVED", OffsetDateTime.now(), safePageable(pageable))
            .map(this::toResponse);
    }

    public Page<ArticleResponse> listPublished(String contentKind, Pageable pageable) {
        if (contentKind == null || contentKind.isBlank()) return listPublished(pageable);
        String normalized = contentKind.trim().toUpperCase();
        if (!java.util.Set.of("GENERAL", "DISEASE_GUIDE").contains(normalized)) {
            throw new com.healthcare.exception.BusinessException(400, "ARTICLE_CONTENT_KIND_INVALID", "Loại bài viết không hợp lệ");
        }
        Page<Article> page = "DISEASE_GUIDE".equals(normalized)
            // Native queries cannot apply a dynamic Sort, so this branch only
            // normalizes the page bounds and rejects any explicit sort.
            ? articleRepository.findClinicallyEligibleDiseaseGuides(boundedPageable(pageable))
            : articleRepository.findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                normalized, "APPROVED", OffsetDateTime.now(), safePageable(pageable));
        return page
            .map(this::toResponse);
    }

    public Page<ArticleResponse> listByAuthor(String authorName, String altName, String pureName, String contentKind, Pageable pageable) {
        Page<Article> page;
        if (contentKind != null && !contentKind.isBlank()) {
            page = articleRepository.findByAuthorNamesAndContentKind(authorName, altName, pureName, contentKind.trim().toUpperCase(), safePageable(pageable));
        } else {
            page = articleRepository.findByAuthorNames(authorName, altName, pureName, safePageable(pageable));
        }
        return page.map(this::toResponse);
    }

    /**
     * Doctor-portal list for an identified doctor. Ownership is the
     * {@code author_doctor_id} written by every doctor create/update, never the
     * free-text {@code author_name}: the tolerant name matching above stays a
     * legacy fallback for rows that predate the V93 backfill and for callers
     * without a doctor identity.
     */
    public Page<ArticleResponse> listByAuthorDoctorId(java.util.UUID authorDoctorId, String contentKind, Pageable pageable) {
        Page<Article> page;
        if (contentKind != null && !contentKind.isBlank()) {
            page = articleRepository.findByAuthorDoctorIdAndContentKind(
                authorDoctorId, contentKind.trim().toUpperCase(), safePageable(pageable));
        } else {
            page = articleRepository.findByAuthorDoctorId(authorDoctorId, safePageable(pageable));
        }
        return page.map(this::toResponse);
    }

    private Pageable safePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.by(Sort.Direction.DESC, "publishedAt"), ALLOWED_SORT_PROPERTIES);
    }

    private Pageable boundedPageable(Pageable pageable) {
        // An empty whitelist rejects every explicit sort with a 400 instead of
        // silently dropping it — native queries keep their own ORDER BY.
        Pageable safe = SafePageRequests.normalize(pageable, Sort.unsorted(), java.util.Set.of());
        return PageRequest.of(safe.getPageNumber(), safe.getPageSize(), Sort.unsorted());
    }

    public ArticleResponse getBySlug(String slug) {
        Article article = articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
                slug, "APPROVED", OffsetDateTime.now())
            .orElseThrow(() -> new ResourceNotFoundException("Article not found"));
        if ("DISEASE_GUIDE".equalsIgnoreCase(article.getContentKind())) {
            article = articleRepository.findClinicallyEligibleDiseaseGuideBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Article not found"));
        }
        return toResponse(article);
    }

    private ArticleResponse toResponse(Article article) {
        return new ArticleResponse(
            article.getId().toString(),
            article.getTitle(),
            article.getSlug(),
            article.getSummary(),
            article.getBody(),
            article.getPublishedAt(),
            article.getCategory(),
            article.getAuthorName(),
            article.getReadingMinutes(),
            article.getRelatedSpecialtySlug(),
            HospitalJsonMapper.articleSections(article.getSections()),
            article.getContentKind(), article.getCoverImageUrl(), article.getSeoTitle(), article.getSeoDescription(),
            article.getTags(), article.getUpdatedAt(), article.getVersion(),
            article.getContentLanguage(), article.getAudience(), article.getTopicTags(),
            article.getKeyTakeaways(), article.getWarningSigns(), article.getPreventionTips(),
            article.getWhenToSeekCare(), article.getSourceReferences(), article.getClinicalMetadata(),
            article.getClinicalDisclaimer(), article.isFeatured(),
            article.getReviewStatus(), article.getReviewReason(), article.getReviewDecidedAt()
        );
    }
}
