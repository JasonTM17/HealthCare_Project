package com.healthcare.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
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

    @Value("${ai.service.token:}")
    private String aiServiceToken;

    public AiService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
        this.restTemplate = restTemplateBuilder
            .messageConverters(
                new ByteArrayHttpMessageConverter(),
                new StringHttpMessageConverter(StandardCharsets.UTF_8)
            )
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
            restTemplate.getForObject(aiServiceUrl + "/health", String.class);
            return true;
        } catch (RestClientException e) {
            return false;
        }
    }

    private Map<String, Object> post(String path, Map<String, Object> request) {
        Object symptoms = request == null ? null : request.get("symptoms");
        if (!(symptoms instanceof String text) || text.trim().length() < 2 || text.length() > 10_000) {
            throw new ResponseStatusException(BAD_REQUEST, "Symptoms must be between 2 and 10000 characters");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (aiServiceToken != null && !aiServiceToken.isBlank()) {
                headers.set("X-AI-Service-Token", aiServiceToken);
            }
            String payload = objectMapper.writeValueAsString(request);
            // Read the raw response as bytes, then decode as UTF-8 explicitly.
            // This avoids RestTemplate applying the response's own charset
            // (often ISO-8859-1 when omitted) which corrupts Vietnamese text.
            byte[] raw = restTemplate.postForObject(
                aiServiceUrl + path,
                new HttpEntity<>(payload, headers),
                byte[].class
            );
            if (raw == null || raw.length == 0) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service returned an empty response");
            }
            String body = new String(raw, StandardCharsets.UTF_8);
            return objectMapper.readValue(body, new TypeReference<Map<String, Object>>() { });
        } catch (RestClientException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned invalid JSON", e);
        }
    }
}
