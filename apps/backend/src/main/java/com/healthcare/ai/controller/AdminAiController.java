package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiCatalogIndexService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/ai")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiController {

    private final AiCatalogIndexService catalogIndexService;

    public AdminAiController(AiCatalogIndexService catalogIndexService) {
        this.catalogIndexService = catalogIndexService;
    }

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
