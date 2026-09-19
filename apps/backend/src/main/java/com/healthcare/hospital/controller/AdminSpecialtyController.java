package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.service.AdminSpecialtyService;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/specialties")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSpecialtyController {

    private final AdminSpecialtyService adminSpecialtyService;

    public AdminSpecialtyController(AdminSpecialtyService adminSpecialtyService) {
        this.adminSpecialtyService = adminSpecialtyService;
    }

    @Operation(summary = "Quản lý danh sách chuyên khoa", description = "Lấy toàn bộ chuyên khoa y tế trong hệ thống phục vụ cấu hình danh mục")
    @GetMapping
    public Page<Specialty> list(@PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminSpecialtyService.list(pageable);
    }

    @Operation(summary = "Thêm mới chuyên khoa", description = "Tạo mới chuyên khoa lâm sàng hoặc cận lâm sàng")
    @PostMapping
    public ResponseEntity<Specialty> create(
            @Valid @RequestBody SpecialtyRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminSpecialtyService.create(request, actor));
    }

    @Operation(summary = "Cập nhật chuyên khoa", description = "Cập nhật mô tả chuyên khoa, triệu chứng lâm sàng và quy trình điều trị")
    @PutMapping("/{slug}")
    public ResponseEntity<Specialty> update(
            @PathVariable String slug,
            @Valid @RequestBody SpecialtyRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminSpecialtyService.update(slug, request, actor));
    }

    @Operation(summary = "Xóa chuyên khoa", description = "Xóa hoặc ngừng hoạt động chuyên khoa khỏi hệ thống")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        adminSpecialtyService.delete(slug, actor);
        return ResponseEntity.noContent().build();
    }
}
