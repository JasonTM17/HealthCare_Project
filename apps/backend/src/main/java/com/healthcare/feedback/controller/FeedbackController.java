package com.healthcare.feedback.controller;

import com.healthcare.feedback.dto.CreateFeedbackRequest;
import com.healthcare.feedback.dto.FeedbackItemResponse;
import com.healthcare.feedback.service.FeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "User Feedback", description = "Góp ý sản phẩm của người dùng đã đăng nhập")
@RestController
@RequestMapping("/api/v1/feedback")
@SecurityRequirement(name = "bearerAuth")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @Operation(summary = "Gửi góp ý mới", description = "Chỉ tài khoản đã đăng nhập; giới hạn 10 góp ý / 24 giờ mỗi tài khoản")
    @PostMapping
    public ResponseEntity<FeedbackItemResponse> submit(
        @AuthenticationPrincipal UserDetails principal,
        @Valid @RequestBody CreateFeedbackRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.submit(principal, request));
    }

    @Operation(summary = "Danh sách góp ý của tôi", description = "Trả về tối đa 20 góp ý gần nhất của tài khoản hiện tại")
    @GetMapping("/mine")
    public ResponseEntity<List<FeedbackItemResponse>> listMine(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(feedbackService.listMine(principal));
    }
}
