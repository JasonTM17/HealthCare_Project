package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.service.AdminArticleService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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

    @GetMapping
    public Page<Article> list(@PageableDefault(size = 20, sort = "title") Pageable pageable) {
        return adminArticleService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Article> create(
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.create(request, actor));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Article> update(
            @PathVariable String slug,
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.update(slug, request, actor));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        adminArticleService.delete(slug, actor);
        return ResponseEntity.noContent().build();
    }
}
