package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleCommentResponse;
import com.healthcare.hospital.dto.CreateCommentRequest;
import com.healthcare.hospital.service.ArticleCommentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;

@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết)")
@RestController
@RequestMapping("/api/v1/hospital/articles/{slug}/comments")
public class ArticleCommentController {

    private final ArticleCommentService commentService;

    public ArticleCommentController(ArticleCommentService commentService) {
        this.commentService = commentService;
    }

    @Operation(summary = "Danh sách bình luận bài viết", description = "Lấy toàn bộ các bình luận và phản hồi y khoa của bài viết theo đường dẫn slug")
    @GetMapping
    public ResponseEntity<List<ArticleCommentResponse>> getComments(@PathVariable String slug) {
        return ResponseEntity.ok(commentService.getComments(slug));
    }

    @Operation(summary = "Thêm bình luận bài viết", description = "Người dùng đăng nhập gửi bình luận hoặc câu hỏi liên quan đến bài viết y tế")
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ArticleCommentResponse> addComment(
            @PathVariable String slug,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commentService.addComment(slug, request, actor));
    }

    @Operation(summary = "Xóa bình luận", description = "Xóa bình luận của chính tác giả hoặc do ban quản trị kiểm duyệt")
    @DeleteMapping("/{commentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteComment(
            @PathVariable String slug,
            @PathVariable UUID commentId,
            @AuthenticationPrincipal UserDetails actor) {
        commentService.deleteComment(commentId, actor);
        return ResponseEntity.noContent().build();
    }
}
