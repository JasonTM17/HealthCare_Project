package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.service.BranchService;
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
@RequestMapping("/api/v1/hospital/branches")
@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ)")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @Operation(summary = "Danh sách cơ sở bệnh viện", description = "Lấy danh sách 20 cơ sở bệnh viện trực thuộc hệ sinh thái HealthCare trên toàn quốc")
    @GetMapping
    public Page<BranchResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return branchService.listActive(pageable);
    }

    @Operation(summary = "Chi tiết cơ sở bệnh viện", description = "Lấy thông tin chi tiết của cơ sở bệnh viện theo slug đường dẫn")
    @GetMapping("/{slug}")
    public BranchResponse getBySlug(
        @Parameter(description = "Slug định danh cơ sở (ví dụ: benh-vien-da-khoa-quoc-te-healthcare-ba-dinh)")
        @PathVariable String slug
    ) {
        return branchService.getBySlug(slug);
    }
}
