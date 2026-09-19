package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ServiceRequest;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.service.AdminServiceService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1/admin/services")
@PreAuthorize("hasRole('ADMIN')")
public class AdminServiceController {

    private final AdminServiceService adminServiceService;

    public AdminServiceController(AdminServiceService adminServiceService) {
        this.adminServiceService = adminServiceService;
    }

    @Operation(summary = "Quản lý danh sách dịch vụ y tế", description = "Lấy toàn bộ các dịch vụ kỹ thuật y tế, xét nghiệm, thủ thuật trong hệ thống")
    @GetMapping
    public Page<MedicalService> list(@PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminServiceService.list(pageable);
    }

    @Operation(summary = "Thêm mới dịch vụ y tế", description = "Tạo mới dịch vụ lâm sàng, phẫu thuật hoặc cận lâm sàng kèm đơn giá")
    @PostMapping
    public ResponseEntity<MedicalService> create(@Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(adminServiceService.create(request));
    }

    @Operation(summary = "Cập nhật dịch vụ y tế", description = "Chỉnh sửa thông tin quy trình, giá dịch vụ và chuyên khoa phụ trách")
    @PutMapping("/{slug}")
    public ResponseEntity<MedicalService> update(@PathVariable String slug, @Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(adminServiceService.update(slug, request));
    }

    @Operation(summary = "Xóa dịch vụ y tế", description = "Xóa hoặc ngừng phục vụ dịch vụ y tế khỏi danh mục")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminServiceService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
