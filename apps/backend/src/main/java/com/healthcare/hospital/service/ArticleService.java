package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class ArticleService {

    private final ArticleRepository articleRepository;

    public ArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    public Page<ArticleResponse> listPublished(Pageable pageable) {
        // General articles remain a public operational catalog. Disease guides
        // are exposed through the explicit content-kind path below so an
        // unapproved/expired clinical source can never leak into the generic
        // feed or receive the doctor-approved trust label.
        return articleRepository.findByContentKindAndActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                "GENERAL", OffsetDateTime.now(), pageable)
            .map(this::toResponse);
    }

    public Page<ArticleResponse> listPublished(String contentKind, Pageable pageable) {
        if (contentKind == null || contentKind.isBlank()) return listPublished(pageable);
        String normalized = contentKind.trim().toUpperCase();
        if (!java.util.Set.of("GENERAL", "DISEASE_GUIDE").contains(normalized)) {
            throw new com.healthcare.exception.BusinessException(400, "ARTICLE_CONTENT_KIND_INVALID", "Loại bài viết không hợp lệ");
        }
        Page<Article> page = "DISEASE_GUIDE".equals(normalized)
            ? articleRepository.findClinicallyEligibleDiseaseGuides(pageable)
            : articleRepository.findByContentKindAndActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                normalized, OffsetDateTime.now(), pageable);
        return page
            .map(this::toResponse);
    }

    public ArticleResponse getBySlug(String slug) {
        Article article = articleRepository.findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
                slug, OffsetDateTime.now())
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
            article.getClinicalDisclaimer(), article.isFeatured()
        );
    }
}
