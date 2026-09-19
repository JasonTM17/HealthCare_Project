package com.healthcare.hospital.controller;

import com.healthcare.hospital.service.PublicSpecialtyTriageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết)")
@RestController
@RequestMapping("/api/v1/public")
public class PublicSpecialtyTriageController {

    private final PublicSpecialtyTriageService publicSpecialtyTriageService;

    public PublicSpecialtyTriageController(PublicSpecialtyTriageService publicSpecialtyTriageService) {
        this.publicSpecialtyTriageService = publicSpecialtyTriageService;
    }

    @Operation(summary = "Gợi ý chuyên khoa theo triệu chứng", description = "Phân tích triệu chứng người dùng mô tả để đề xuất chuyên khoa khám phù hợp nhất")
    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> recommend(@Valid @RequestBody PublicTriageRequest request) {
        return ResponseEntity.ok(publicSpecialtyTriageService.triage(request.symptoms()));
    }

    public record PublicTriageRequest(@NotBlank @Size(min = 2, max = 500) String symptoms) {
    }
}
