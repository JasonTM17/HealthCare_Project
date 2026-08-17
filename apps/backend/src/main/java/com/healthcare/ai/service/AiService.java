package com.healthcare.ai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class AiService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public Map<String, Object> symptomCheck(String symptoms) {
        String url = aiServiceUrl + "/api/v1/symptom-check";
        return restTemplate.postForObject(url, Map.of("symptoms", symptoms), Map.class);
    }

    public Map<String, Object> recommendSpecialty(String symptoms) {
        String url = aiServiceUrl + "/api/v1/specialty-recommendation";
        return restTemplate.postForObject(url, Map.of("symptoms", symptoms), Map.class);
    }

    public Map<String, Object> recommendDoctor(String specialtyId) {
        String url = aiServiceUrl + "/api/v1/doctor-recommendation";
        return restTemplate.postForObject(url, Map.of("specialtyId", specialtyId), Map.class);
    }

    public boolean isAvailable() {
        try {
            restTemplate.getForObject(aiServiceUrl + "/health", Map.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
