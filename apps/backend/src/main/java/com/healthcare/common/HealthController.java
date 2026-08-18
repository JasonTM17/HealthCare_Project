package com.healthcare.common;

import com.healthcare.ai.service.AiService;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final AiService aiService;

    public HealthController(AiService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        boolean aiReady = aiService.isAvailable();
        return ResponseEntity
            .status(aiReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "status", aiReady ? "ok" : "degraded",
                "service", "healthcare-backend",
                "ai_status", aiReady ? "ok" : "unavailable",
                "ai_ready", aiReady,
                "timestamp", Instant.now().toString()
            ));
    }
}
