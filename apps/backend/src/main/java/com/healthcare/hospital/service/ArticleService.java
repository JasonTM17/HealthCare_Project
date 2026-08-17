package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
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
        return articleRepository.findByActiveTrueOrderByPublishedAtDesc(pageable).map(this::toResponse);
    }

    public ArticleResponse getBySlug(String slug) {
        return articleRepository.findBySlug(slug)
            .map(this::toResponse)
            .orElse(null);
    }

    private ArticleResponse toResponse(Article article) {
        return new ArticleResponse(
            article.getId().toString(),
            article.getTitle(),
            article.getSlug(),
            article.getSummary(),
            article.getPublishedAt()
        );
    }
}
