package com.healthcare.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class AiService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public AiService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
        this.restTemplate = restTemplateBuilder
            .additionalMessageConverters(new StringHttpMessageConverter(StandardCharsets.UTF_8))
            .build();
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> symptomCheck(Map<String, Object> request) {
        return post("/triage", request);
    }

    public Map<String, Object> recommendSpecialty(Map<String, Object> request) {
        return post("/recommendations/specialty", request);
    }

    public boolean isAvailable() {
        try {
            restTemplate.getForObject(aiServiceUrl + "/health", Map.class);
            return true;
        } catch (RestClientException e) {
            return false;
        }
    }

    private Map<String, Object> post(String path, Map<String, Object> request) {
        Object symptoms = request == null ? null : request.get("symptoms");
        if (!(symptoms instanceof String text) || text.isBlank() || text.length() > 10_000) {
            throw new ResponseStatusException(BAD_REQUEST, "Symptoms must be between 1 and 10000 characters");
        }

        try {
            String raw = restTemplate.postForObject(aiServiceUrl + path, request, String.class);
            if (raw == null || raw.isBlank()) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service returned an empty response");
            }
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() { });
        } catch (RestClientException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned invalid JSON", e);
        }
    }
}
