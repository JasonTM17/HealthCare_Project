package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.AdminDoctorResponse;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.service.AdminDoctorService;
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
@RequestMapping("/api/v1/admin/doctors")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDoctorController {

    private final AdminDoctorService adminDoctorService;

    public AdminDoctorController(AdminDoctorService adminDoctorService) {
        this.adminDoctorService = adminDoctorService;
    }

    @Operation(summary = "Quản lý danh sách bác sĩ", description = "Lấy danh sách toàn bộ bác sĩ trong hệ thống dành cho ban quản trị")
    @GetMapping
    public Page<AdminDoctorResponse> list(@PageableDefault(size = 20, sort = "fullName") Pageable pageable) {
        return adminDoctorService.list(pageable);
    }

    @Operation(summary = "Thêm mới hồ sơ bác sĩ", description = "Tạo mới bác sĩ, gán chuyên khoa và các cơ sở bệnh viện trực thuộc")
    @PostMapping
    public ResponseEntity<Doctor> create(@Valid @RequestBody DoctorRequest request) {
        return ResponseEntity.ok(adminDoctorService.create(request));
    }

    @Operation(summary = "Cập nhật hồ sơ bác sĩ", description = "Chỉnh sửa thông tin chức danh, tiểu sử và chuyên môn của bác sĩ")
    @PutMapping("/{slug}")
    public ResponseEntity<Doctor> update(@PathVariable String slug, @Valid @RequestBody DoctorRequest request) {
        return ResponseEntity.ok(adminDoctorService.update(slug, request));
    }

    @Operation(summary = "Xóa hồ sơ bác sĩ", description = "Xóa mềm hoặc ngừng hoạt động hồ sơ bác sĩ khỏi danh mục")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminDoctorService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
