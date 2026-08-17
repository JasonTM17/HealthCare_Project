package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.service.AdminArticleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/articles")
@PreAuthorize("hasRole('ADMIN')")
public class AdminArticleController {

    private final AdminArticleService adminArticleService;

    public AdminArticleController(AdminArticleService adminArticleService) {
        this.adminArticleService = adminArticleService;
    }

    @PostMapping
    public ResponseEntity<Article> create(@Valid @RequestBody ArticleRequest request) {
        return ResponseEntity.ok(adminArticleService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Article> update(@PathVariable String slug, @Valid @RequestBody ArticleRequest request) {
        return ResponseEntity.ok(adminArticleService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminArticleService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
