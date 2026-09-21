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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/articles")
@PreAuthorize("hasRole('ADMIN')")
public class AdminArticleController {

    private final AdminArticleService adminArticleService;

    public AdminArticleController(AdminArticleService adminArticleService) {
        this.adminArticleService = adminArticleService;
    }

    @Operation(summary = "Quản lý danh sách bài viết", description = "Lấy toàn bộ bài viết cẩm nang y tế và hướng dẫn phòng bệnh")
    @GetMapping
    public Page<Article> list(@PageableDefault(size = 20, sort = "title") Pageable pageable) {
        return adminArticleService.list(pageable);
    }

    @Operation(summary = "Thêm mới bài viết y tế", description = "Tạo mới bài viết cẩm nang sức khỏe kèm tác giả bác sĩ và chuyên khoa liên quan")
    @PostMapping
    public ResponseEntity<Article> create(
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.create(request, actor));
    }

    @Operation(summary = "Cập nhật bài viết y tế", description = "Chỉnh sửa tiêu đề, tóm tắt, nội dung chi tiết và hình ảnh đại diện của bài viết")
    @PutMapping("/{slug}")
    public ResponseEntity<Article> update(
            @PathVariable String slug,
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.update(slug, request, actor));
    }

    @Operation(summary = "Xóa bài viết y tế", description = "Xóa hoặc gỡ xuất bản bài viết khỏi cẩm nang y tế")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        adminArticleService.delete(slug, actor);
        return ResponseEntity.noContent().build();
    }

    @Operation(
        summary = "Duyệt hoặc từ chối bài của bác sĩ",
        description = "APPROVED đưa bài sang chuyên trang công khai; REJECTED gỡ khỏi trang công khai nhưng vẫn hiển thị cho tác giả kèm lý do")
    @PutMapping("/{slug}/review")
    public ResponseEntity<Article> review(
            @PathVariable String slug,
            @Valid @RequestBody ArticleReviewRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.review(slug, request.decision(), request.reason(), actor));
    }

    /**
     * Body of the review decision. `reason` is optional on approval and becomes
     * the author-facing explanation on rejection (capped to fit alongside the
     * other article fields in one admin response).
     */
    public record ArticleReviewRequest(
            @jakarta.validation.constraints.NotBlank String decision,
            @jakarta.validation.constraints.Size(max = 500) String reason) {
    }
}
