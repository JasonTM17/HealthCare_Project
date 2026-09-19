package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.dto.CatalogOrderRequest;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.service.AdminPackageService;
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
import java.util.List;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/packages")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPackageController {

    private final AdminPackageService adminPackageService;

    public AdminPackageController(AdminPackageService adminPackageService) {
        this.adminPackageService = adminPackageService;
    }

    @Operation(summary = "Quản lý danh sách gói khám", description = "Lấy toàn bộ các gói khám sức khỏe tổng quát, chuyên sâu để quản trị")
    @GetMapping
    public Page<Package> list(@PageableDefault(size = 20, sort = {"displayOrder", "id"}) Pageable pageable) {
        return adminPackageService.list(pageable);
    }

    @Operation(summary = "Sắp xếp thứ tự hiển thị gói khám", description = "Cập nhật vị trí hiển thị ưu tiên của các gói khám trên trang chủ và danh mục")
    @PutMapping("/order")
    public List<Package> reorder(@Valid @RequestBody CatalogOrderRequest request) {
        return adminPackageService.reorder(request);
    }

    @Operation(summary = "Thêm mới gói khám sức khỏe", description = "Tạo mới gói khám bệnh, giá tiền niêm yết và chi tiết danh mục xét nghiệm")
    @PostMapping
    public ResponseEntity<Package> create(@Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(adminPackageService.create(request));
    }

    @Operation(summary = "Cập nhật gói khám sức khỏe", description = "Chỉnh sửa nội dung, giá tiền, thời lượng và điều kiện chuẩn bị trước khi khám")
    @PutMapping("/{slug}")
    public ResponseEntity<Package> update(@PathVariable String slug, @Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(adminPackageService.update(slug, request));
    }

    @Operation(summary = "Xóa gói khám", description = "Xóa hoặc ngừng kinh doanh gói khám khỏi danh mục")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminPackageService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
