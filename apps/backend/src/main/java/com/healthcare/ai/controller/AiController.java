package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/symptom-check")
    public ResponseEntity<Map<String, Object>> symptomCheck(@RequestBody AiRequest request) {
        return ResponseEntity.ok(aiService.symptomCheck(Map.of("symptoms", request.symptoms())));
    }

    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> specialtyRecommendation(@RequestBody AiRequest request) {
        return ResponseEntity.ok(aiService.recommendSpecialty(Map.of("symptoms", request.symptoms())));
    }

    public record AiRequest(String symptoms) {
    }
}
