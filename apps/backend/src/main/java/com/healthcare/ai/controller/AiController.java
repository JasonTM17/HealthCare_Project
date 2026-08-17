package com.healthcare.ai.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class AiController {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @PostMapping("/symptom-check")
    public ResponseEntity<Map<String, Object>> symptomCheck(@RequestBody Map<String, Object> request) {
        String url = aiServiceUrl + "/api/v1/symptom-check";
        Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> specialtyRecommendation(@RequestBody Map<String, Object> request) {
        String url = aiServiceUrl + "/api/v1/specialty-recommendation";
        Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/doctor-recommendation")
    public ResponseEntity<Map<String, Object>> doctorRecommendation(@RequestBody Map<String, Object> request) {
        String url = aiServiceUrl + "/api/v1/doctor-recommendation";
        Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
        return ResponseEntity.ok(response);
    }
}
