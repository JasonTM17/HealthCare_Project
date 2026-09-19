package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.SpecialtyResponse;
import com.healthcare.hospital.service.SpecialtyService;
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

@RestController
@RequestMapping("/api/v1/hospital/specialties")
@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ)")
public class SpecialtyController {

    private final SpecialtyService specialtyService;

    public SpecialtyController(SpecialtyService specialtyService) {
        this.specialtyService = specialtyService;
    }

    @Operation(summary = "Danh sách chuyên khoa", description = "Lấy danh sách 30 chuyên khoa mũi nhọn (Tim mạch, Thần kinh, Tiêu hóa, v.v.)")
    @GetMapping
    public Page<SpecialtyResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return specialtyService.listActive(pageable);
    }

    @Operation(summary = "Chi tiết chuyên khoa", description = "Lấy thông tin mô tả chi tiết của chuyên khoa theo slug")
    @GetMapping("/{slug}")
    public SpecialtyResponse getBySlug(
        @Parameter(description = "Slug định danh chuyên khoa (ví dụ: tim-mach, than-kinh)")
        @PathVariable String slug
    ) {
        return specialtyService.getBySlug(slug);
    }
}
