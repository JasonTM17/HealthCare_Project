package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.dto.CatalogOrderRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.service.AdminFaqService;
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
import java.util.UUID;
import java.util.List;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/faqs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminFaqController {

    private final AdminFaqService adminFaqService;

    public AdminFaqController(AdminFaqService adminFaqService) {
        this.adminFaqService = adminFaqService;
    }

    @Operation(summary = "Quản lý câu hỏi thường gặp FAQ", description = "Lấy toàn bộ các câu hỏi đáp thường gặp trong hệ thống")
    @GetMapping
    public Page<Faq> list(@PageableDefault(size = 20, sort = {"displayOrder", "id"}) Pageable pageable) {
        return adminFaqService.list(pageable);
    }

    @Operation(summary = "Sắp xếp thứ tự hiển thị FAQ", description = "Cập nhật thứ tự hiển thị câu hỏi thường gặp")
    @PutMapping("/order")
    public List<Faq> reorder(@Valid @RequestBody CatalogOrderRequest request) {
        return adminFaqService.reorder(request);
    }

    @Operation(summary = "Thêm mới FAQ", description = "Tạo câu hỏi và câu trả lời thường gặp mới")
    @PostMapping
    public ResponseEntity<Faq> create(
            @Valid @RequestBody FaqRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminFaqService.create(request, actor));
    }

    @Operation(summary = "Cập nhật FAQ", description = "Chỉnh sửa nội dung câu hỏi hoặc câu trả lời thường gặp")
    @PutMapping("/{id}")
    public ResponseEntity<Faq> update(
            @PathVariable UUID id,
            @Valid @RequestBody FaqRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminFaqService.update(id, request, actor));
    }

    @Operation(summary = "Xóa FAQ", description = "Xóa câu hỏi thường gặp khỏi hệ thống")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails actor) {
        adminFaqService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }
}
