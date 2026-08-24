package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class ArticleService {

    private final ArticleRepository articleRepository;

    public ArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    public Page<ArticleResponse> listPublished(Pageable pageable) {
        return articleRepository.findByActiveTrueAndPublishedAtIsNotNullOrderByPublishedAtDesc(pageable)
            .map(this::toResponse);
    }

    public Page<ArticleResponse> listPublished(String contentKind, Pageable pageable) {
        if (contentKind == null || contentKind.isBlank()) return listPublished(pageable);
        String normalized = contentKind.trim().toUpperCase();
        if (!java.util.Set.of("GENERAL", "DISEASE_GUIDE").contains(normalized)) {
            throw new com.healthcare.exception.BusinessException(400, "ARTICLE_CONTENT_KIND_INVALID", "Loại bài viết không hợp lệ");
        }
        return articleRepository.findByContentKindAndActiveTrueAndPublishedAtIsNotNullOrderByPublishedAtDesc(normalized, pageable)
            .map(this::toResponse);
    }

    public ArticleResponse getBySlug(String slug) {
        return articleRepository.findBySlugAndActiveTrueAndPublishedAtIsNotNull(slug)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Article not found"));
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
