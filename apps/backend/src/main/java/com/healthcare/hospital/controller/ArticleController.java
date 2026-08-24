package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.service.ArticleService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/v1/hospital/articles")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping
    public Page<ArticleResponse> list(@RequestParam(required = false) String contentKind,
                                      @PageableDefault(size = 20) Pageable pageable) {
        return articleService.listPublished(contentKind, pageable);
    }

    @GetMapping("/{slug}")
    public ArticleResponse getBySlug(@PathVariable String slug) {
        return articleService.getBySlug(slug);
    }
}
