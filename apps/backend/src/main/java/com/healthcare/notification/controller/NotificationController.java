package com.healthcare.notification.controller;

import com.healthcare.notification.dto.NotificationResponse;
import com.healthcare.notification.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.UUID;

@Tag(name = "Notifications", description = "Trung tâm thông báo hệ thống: Lịch hẹn, đơn thuốc, thanh toán và khuyến cáo sức khỏe")
@RestController
@RequestMapping("/api/v1/notifications")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Operation(summary = "Danh sách thông báo của người dùng", description = "Lấy danh sách thông báo gửi đến tài khoản người dùng có phân trang")
    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> list(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(notificationService.listForUser(userDetails, pageable));
    }

    @Operation(summary = "Đánh dấu một thông báo đã đọc", description = "Chuyển trạng thái thông báo cụ thể sang đã đọc")
    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAsRead(id, userDetails);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Đánh dấu tất cả thông báo đã đọc", description = "Đánh dấu toàn bộ thông báo chưa đọc của người dùng hiện tại thành đã đọc")
    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Integer>> markAllAsRead(
            @AuthenticationPrincipal UserDetails userDetails) {
        int updated = notificationService.markAllAsRead(userDetails);
        return ResponseEntity.ok(Map.of("updated", updated));
    }
}
