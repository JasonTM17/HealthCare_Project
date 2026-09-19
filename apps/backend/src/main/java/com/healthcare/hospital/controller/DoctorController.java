package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.service.DoctorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/v1/hospital/doctors")
@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ)")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @Operation(summary = "Tìm kiếm và tra cứu danh sách bác sĩ", description = "Tra cứu 500+ bác sĩ chuyên khoa với các bộ lọc theo chuyên khoa, cơ sở và từ khóa tên")
    @GetMapping
    public Page<DoctorResponse> list(
        @PageableDefault(size = 20) Pageable pageable,
        @Parameter(description = "Lọc theo slug chuyên khoa (ví dụ: tim-mach)")
        @RequestParam(required = false) String specialtySlug,
        @Parameter(description = "Lọc theo slug cơ sở bệnh viện (ví dụ: benh-vien-da-khoa-quoc-te-healthcare-ba-dinh)")
        @RequestParam(required = false) String branchSlug,
        @Parameter(description = "Từ khóa tìm kiếm theo họ tên bác sĩ")
        @RequestParam(required = false) String q
    ) {
        return doctorService.listActive(pageable, specialtySlug, branchSlug, q);
    }

    @Operation(summary = "Hồ sơ chi tiết bác sĩ", description = "Lấy thông tin học vị, tiểu sử chuyên môn, cơ sở công tác và lịch khám của bác sĩ")
    @GetMapping("/{slug}")
    public DoctorResponse getBySlug(
        @Parameter(description = "Slug định danh bác sĩ (ví dụ: nguyen-minh-khoi)")
        @PathVariable String slug
    ) {
        return doctorService.getBySlug(slug);
    }
}
