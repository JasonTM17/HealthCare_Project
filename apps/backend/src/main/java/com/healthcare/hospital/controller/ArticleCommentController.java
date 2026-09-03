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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hospital/articles/{slug}/comments")
public class ArticleCommentController {

    private final ArticleCommentService commentService;

    public ArticleCommentController(ArticleCommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    public ResponseEntity<List<ArticleCommentResponse>> getComments(@PathVariable String slug) {
        return ResponseEntity.ok(commentService.getComments(slug));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ArticleCommentResponse> addComment(
            @PathVariable String slug,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commentService.addComment(slug, request, actor));
    }

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
