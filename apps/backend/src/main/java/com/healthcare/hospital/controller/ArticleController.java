package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ)")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @Operation(summary = "Danh sách bài viết cẩm nang sức khỏe", description = "Tra cứu danh sách 500+ bài viết y khoa và cẩm nang phổ biến đã qua kiểm duyệt")
    @GetMapping
    public Page<ArticleResponse> list(
        @Parameter(description = "Phân loại nội dung: ARTICLE, DISEASE_GUIDE")
        @RequestParam(required = false) String contentKind,
        @PageableDefault(size = 20) Pageable pageable
    ) {
        return articleService.listPublished(contentKind, pageable);
    }

    @Operation(summary = "Chi tiết bài viết y khoa", description = "Lấy nội dung chi tiết bài viết, cấu trúc mục lục, tác giả bác sĩ và các nguồn tài liệu y khoa tham khảo")
    @GetMapping("/{slug}")
    public ArticleResponse getBySlug(
        @Parameter(description = "Slug định danh bài viết (ví dụ: huong-dan-xu-tri-tang-huyet-ap)")
        @PathVariable String slug
    ) {
        return articleService.getBySlug(slug);
    }
}
