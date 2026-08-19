package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class AdminArticleService {

    private final ArticleRepository articleRepository;

    public AdminArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    @Transactional
    public Article create(ArticleRequest request) {
        if (articleRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Article slug already exists: " + request.slug());
        }
        Article article = new Article();
        article.setTitle(request.title());
        article.setSlug(request.slug());
        article.setSummary(request.summary());
        article.setBody(request.body());
        article.setActive(request.active());
        article.setPublishedAt(request.active() ? OffsetDateTime.now() : null);
        return articleRepository.save(article);
    }

    @Transactional
    public Article update(String slug, ArticleRequest request) {
        Article article = articleRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Article not found: " + slug));
        if (!slug.equals(request.slug()) && articleRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Article slug already exists: " + request.slug());
        }
        article.setTitle(request.title());
        article.setSlug(request.slug());
        article.setSummary(request.summary());
        article.setBody(request.body());
        article.setActive(request.active());
        article.setPublishedAt(request.active() ? OffsetDateTime.now() : null);
        return articleRepository.save(article);
    }

    @Transactional
    public void delete(String slug) {
        Article article = articleRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Article not found: " + slug));
        articleRepository.delete(article);
    }
}
