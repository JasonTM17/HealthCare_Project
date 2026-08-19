package com.healthcare.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.net.URI;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AiService {

    private static final int DEFAULT_MAX_INPUT_CHARS = 10_000;
    private static final int DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${ai.service.token:}")
    private String aiServiceToken;

    @Value("${ai.service.runtime:non-local}")
    private String aiServiceRuntime = "non-local";

    @Value("${ai.service.allow-unauthenticated-local:false}")
    private boolean allowUnauthenticatedLocal;

    @Value("${ai.service.max-input-chars:10000}")
    private int maxInputChars = DEFAULT_MAX_INPUT_CHARS;

    @Value("${ai.service.max-response-bytes:1048576}")
    private int maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES;

    @Value("${ai.rag-ingest.enabled:false}")
    private boolean ragIngestEnabled;

    @Value("${ai.rag-ingest.token:}")
    private String ragIngestToken;

    /** Test-friendly constructor with the same safe defaults as production. */
    public AiService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
        this(restTemplateBuilder, objectMapper, Duration.ofSeconds(1), Duration.ofSeconds(10));
    }

    @Autowired
    public AiService(
        RestTemplateBuilder restTemplateBuilder,
        ObjectMapper objectMapper,
        @Value("${ai.service.connect-timeout-ms:1000}") long connectTimeoutMs,
        @Value("${ai.service.read-timeout-ms:10000}") long readTimeoutMs
    ) {
        this(
            restTemplateBuilder,
            objectMapper,
            boundedDuration(connectTimeoutMs, Duration.ofSeconds(1)),
            boundedDuration(readTimeoutMs, Duration.ofSeconds(10))
        );
    }

    private AiService(
        RestTemplateBuilder restTemplateBuilder,
        ObjectMapper objectMapper,
        Duration connectTimeout,
        Duration readTimeout
    ) {
        this.restTemplate = restTemplateBuilder
            .requestFactory(SimpleClientHttpRequestFactory::new)
            .setConnectTimeout(connectTimeout)
            .setReadTimeout(readTimeout)
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

    public Map<String, Object> search(String query, int topK) {
        String normalizedQuery = validateQuery(query);
        if (topK < 1 || topK > 20) {
            throw new ResponseStatusException(BAD_REQUEST, "Search result limit must be between 1 and 20");
        }
        ensureServiceAuthConfiguration();

        try {
            String payload = objectMapper.writeValueAsString(
                Map.of("query", normalizedQuery, "top_k", topK)
            );
            return exchange(
                HttpMethod.POST,
                URI.create(endpoint("/search")),
                new HttpEntity<>(payload, headers())
            );
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI request could not be encoded", e);
        }
    }

    public boolean isRagIngestConfigured() {
        return ragIngestEnabled && ragIngestToken != null && !ragIngestToken.isBlank()
            && hasServiceAuthConfiguration();
    }

    public Map<String, Object> indexDocument(Map<String, Object> document) {
        if (!isRagIngestConfigured()) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "RAG ingestion is not configured");
        }
        try {
            HttpHeaders ingestHeaders = headers();
            ingestHeaders.set("X-RAG-Ingest-Token", ragIngestToken);
            return exchange(
                HttpMethod.POST,
                URI.create(endpoint("/rag/index")),
                new HttpEntity<>(objectMapper.writeValueAsString(document), ingestHeaders)
            );
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "RAG document could not be encoded", e);
        }
    }

    public boolean isAvailable() {
        if (!hasServiceAuthConfiguration()) {
            return false;
        }
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                URI.create(endpoint("/health")),
                HttpMethod.GET,
                new HttpEntity<>(headers()),
                byte[].class
            );
            if (!response.getStatusCode().is2xxSuccessful()
                || response.getBody() == null
                || response.getBody().length == 0) {
                return false;
            }
            Map<String, Object> health = objectMapper.readValue(
                new String(response.getBody(), StandardCharsets.UTF_8),
                new TypeReference<Map<String, Object>>() { }
            );
            Object status = health.get("status");
            Object ready = health.get("ready");
            return "ok".equals(status) && Boolean.TRUE.equals(ready);
        } catch (RestClientException | JsonProcessingException e) {
            return false;
        }
    }

    private Map<String, Object> post(String path, Map<String, Object> request) {
        String symptoms = extractSymptoms(request);
        ensureServiceAuthConfiguration();

        try {
            HttpHeaders headers = headers();
            Map<String, Object> normalizedRequest = Map.of("symptoms", symptoms);
            String payload = objectMapper.writeValueAsString(normalizedRequest);
            return exchange(
                HttpMethod.POST,
                URI.create(endpoint(path)),
                new HttpEntity<>(payload, headers)
            );
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI request could not be encoded", e);
        }
    }

    private Map<String, Object> exchange(HttpMethod method, URI uri, HttpEntity<?> requestEntity) {
        try {
            HttpEntity<?> entity = requestEntity == null
                ? new HttpEntity<>(headers())
                : requestEntity;
            byte[] raw = restTemplate.exchange(uri, method, entity, byte[].class).getBody();
            if (raw == null || raw.length == 0) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service returned an empty response");
            }
            int responseLimit = maxResponseBytes > 0 ? maxResponseBytes : DEFAULT_MAX_RESPONSE_BYTES;
            if (raw.length > responseLimit) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service response exceeded the configured limit");
            }
            String body = new String(raw, StandardCharsets.UTF_8);
            return objectMapper.readValue(body, new TypeReference<Map<String, Object>>() { });
        } catch (RestClientResponseException e) {
            log.warn("AI upstream returned HTTP {} for {}", e.getStatusCode().value(), uri.getPath());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (RestClientException e) {
            log.warn("AI upstream request failed for {}: {}", uri.getPath(), e.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned invalid JSON", e);
        }
    }

    private String extractSymptoms(Map<String, Object> request) {
        Object symptoms = request == null ? null : request.get("symptoms");
        if (!(symptoms instanceof String text)) {
            throw new ResponseStatusException(BAD_REQUEST, "Symptoms must be between 2 and 10000 characters");
        }
        String normalized = text.trim();
        int inputLimit = maxInputChars > 0 ? Math.min(maxInputChars, DEFAULT_MAX_INPUT_CHARS) : DEFAULT_MAX_INPUT_CHARS;
        if (normalized.length() < 2 || normalized.length() > inputLimit) {
            throw new ResponseStatusException(BAD_REQUEST, "Symptoms must be between 2 and 10000 characters");
        }
        return normalized;
    }

    private String validateQuery(String query) {
        if (query == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Search query is required");
        }
        String normalized = query.trim();
        if (normalized.isEmpty() || normalized.length() > DEFAULT_MAX_INPUT_CHARS) {
            throw new ResponseStatusException(BAD_REQUEST, "Search query must be between 1 and 10000 characters");
        }
        return normalized;
    }

    private void ensureServiceAuthConfiguration() {
        if (!hasServiceAuthConfiguration()) {
            throw new ResponseStatusException(
                SERVICE_UNAVAILABLE,
                "AI service authentication is not configured"
            );
        }
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (aiServiceToken != null && !aiServiceToken.isBlank()) {
            headers.set("X-AI-Service-Token", aiServiceToken);
        }
        return headers;
    }

    private String endpoint(String path) {
        String base = aiServiceUrl == null ? "" : aiServiceUrl.strip();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + path;
    }

    private boolean hasServiceAuthConfiguration() {
        return (aiServiceToken != null && !aiServiceToken.isBlank())
            || ("local".equalsIgnoreCase(aiServiceRuntime) && allowUnauthenticatedLocal);
    }

    private static Duration boundedDuration(long millis, Duration fallback) {
        return millis > 0 ? Duration.ofMillis(millis) : fallback;
    }
}
