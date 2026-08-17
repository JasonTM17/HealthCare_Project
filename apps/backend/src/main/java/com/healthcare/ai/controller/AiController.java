package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/symptom-check")
    public ResponseEntity<Map<String, Object>> symptomCheck(@Valid @RequestBody AiRequest request) {
        return ResponseEntity.ok(aiService.symptomCheck(Map.of("symptoms", request.symptoms())));
    }

    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> specialtyRecommendation(@Valid @RequestBody AiRequest request) {
        return ResponseEntity.ok(aiService.recommendSpecialty(Map.of("symptoms", request.symptoms())));
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(
        @RequestParam("q") String query,
        @RequestParam(name = "top_k", defaultValue = "5") int topK
    ) {
        if (query == null || query.isBlank() || query.length() > 10_000) {
            throw new ResponseStatusException(BAD_REQUEST, "Search query must be between 1 and 10000 characters");
        }
        if (topK < 1 || topK > 20) {
            throw new ResponseStatusException(BAD_REQUEST, "Search result limit must be between 1 and 20");
        }
        return ResponseEntity.ok(aiService.search(query, topK));
    }

    public record AiRequest(@NotBlank @Size(min = 2, max = 10_000) String symptoms) {
    }
}
