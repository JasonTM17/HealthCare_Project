package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiCatalogIndexService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

@Tag(name = "Administration", description = "Cổng quản trị dành riêng cho Ban Quản trị hệ thống")
@RestController
@RequestMapping("/api/v1/admin/ai")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiController {

    private final AiCatalogIndexService catalogIndexService;

    public AdminAiController(AiCatalogIndexService catalogIndexService) {
        this.catalogIndexService = catalogIndexService;
    }

    @Operation(summary = "Đồng bộ danh mục y tế vào bộ nhớ RAG AI", description = "Quét và đồng bộ toàn bộ cơ sở, chuyên khoa, bác sĩ, gói khám, dịch vụ vào kho dữ liệu vector AI")
    @PostMapping("/catalog/sync")
    public ResponseEntity<Map<String, Object>> synchronizeCatalog() {
        int processed = catalogIndexService.synchronizeCatalogNow();
        return ResponseEntity.ok(Map.of(
            "status", "COMPLETED",
            "processedDocuments", processed,
            "completedAt", OffsetDateTime.now().toString()
        ));
    }
}
