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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.net.URI;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AiService {

    private static final int DEFAULT_MAX_INPUT_CHARS = 10_000;
    private static final int MIN_CHAT_INPUT_CHARS = 2;
    private static final int DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @FunctionalInterface
    public interface ChatDeltaConsumer {
        void accept(String delta) throws IOException;
    }

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

    public Map<String, Object> chat(Map<String, Object> request) {
        if (request == null || !(request.get("message") instanceof String message)
            || message.trim().length() < MIN_CHAT_INPUT_CHARS) {
            throw new ResponseStatusException(BAD_REQUEST, "Message must be between 2 and 10000 characters");
        }
        String normalized = message.trim();
        int inputLimit = maxInputChars > 0 ? Math.min(maxInputChars, DEFAULT_MAX_INPUT_CHARS) : DEFAULT_MAX_INPUT_CHARS;
        if (normalized.length() > inputLimit) {
            throw new ResponseStatusException(BAD_REQUEST, "Message must be between 2 and " + inputLimit + " characters");
        }
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("message", normalized);
        Object recentTurns = request.get("recent_turns");
        if (recentTurns == null) {
            recentTurns = request.get("recent_history");
        }
        payload.put("recent_turns", normalizeRecentTurns(recentTurns));
        Object publicSupportChat = request.get("public_support_chat");
        if (publicSupportChat == null) {
            publicSupportChat = request.get("publicSupportChat");
        }
        if (publicSupportChat != null) payload.put("public_support_chat", publicSupportChat);
        return postJson("/chat", payload);
    }

    /**
     * The AI service enforces these bounds at its schema edge; enforcing them
     * here too turns an oversized/ill-typed relay payload into a 400 at the
     * Spring boundary instead of an opaque 502 after the cross-service hop.
     */
    private static List<Map<String, String>> normalizeRecentTurns(Object rawTurns) {
        if (rawTurns == null) {
            return List.of();
        }
        if (!(rawTurns instanceof List<?> turns) || turns.size() > 6) {
            throw new ResponseStatusException(BAD_REQUEST, "recent_turns must contain at most 6 turns");
        }
        List<Map<String, String>> normalized = new java.util.ArrayList<>();
        for (Object rawTurn : turns) {
            if (!(rawTurn instanceof Map<?, ?> turn)
                    || !(turn.get("role") instanceof String role)
                    || !(role.equals("user") || role.equals("assistant"))
                    || !(turn.get("content") instanceof String content)) {
                throw new ResponseStatusException(BAD_REQUEST,
                    "recent_turns entries must be {role: user|assistant, content: string}");
            }
            String trimmedContent = content.trim();
            if (trimmedContent.isEmpty() || trimmedContent.length() > 2_000) {
                throw new ResponseStatusException(BAD_REQUEST,
                    "recent_turns content must be between 1 and 2000 characters");
            }
            normalized.add(Map.of("role", role, "content", trimmedContent));
        }
        return normalized;
    }

    /**
     * First half of the patient-chat contract. Retrieval never invokes a
     * language model; Spring must validate the returned identities before
     * calling {@link #generateChat(Map)}.
     */
    public Map<String, Object> retrieveChat(Map<String, Object> request) {
        return postJson("/chat/retrieve", normalizePatientChatPayload(request, false));
    }

    /** Alias used by callers that prefer the endpoint terminology. */
    public Map<String, Object> retrieveChatCandidates(Map<String, Object> request) {
        return retrieveChat(request);
    }

    /**
     * Second half of the patient-chat contract. The authorized source list is
     * an exact Spring-owned allowlist; this method does not add provider data.
     */
    public Map<String, Object> generateChat(Map<String, Object> request) {
        return postJson("/chat/generate", normalizePatientChatPayload(request, true));
    }

    /** Alias retained for explicit two-step call sites and test doubles. */
    public Map<String, Object> generateGroundedChat(Map<String, Object> request) {
        return generateChat(request);
    }

    public Map<String, Object> generateChatStream(
            Map<String, Object> request,
            ChatDeltaConsumer onDelta) {
        Map<String, Object> payload = normalizePatientChatPayload(request, true);
        ensureServiceAuthConfiguration();
        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            Map<String, Object> response = restTemplate.execute(
                URI.create(endpoint("/chat/generate/stream")),
                HttpMethod.POST,
                clientRequest -> {
                    clientRequest.getHeaders().putAll(headers());
                    clientRequest.getHeaders().setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
                    clientRequest.getBody().write(body);
                },
                clientResponse -> readChatSse(clientResponse.getBody(), onDelta)
            );
            if (response == null || response.isEmpty()) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service stream returned an empty response");
            }
            return response;
        } catch (RestClientResponseException e) {
            log.warn("AI upstream returned HTTP {} for {}", e.getStatusCode().value(), "/chat/generate/stream");
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (RestClientException e) {
            log.warn("AI upstream stream request failed for {}: {}", "/chat/generate/stream", e.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI request could not be encoded", e);
        }
    }

    private Map<String, Object> normalizePatientChatPayload(Map<String, Object> request, boolean generation) {
        if (request == null || !(request.get("message") instanceof String message)) {
            throw new ResponseStatusException(BAD_REQUEST, "Message must be between 2 and 10000 characters");
        }
        String normalized = message.trim();
        int inputLimit = maxInputChars > 0
            ? Math.min(maxInputChars, DEFAULT_MAX_INPUT_CHARS)
            : DEFAULT_MAX_INPUT_CHARS;
        if (normalized.length() < MIN_CHAT_INPUT_CHARS || normalized.length() > inputLimit) {
            throw new ResponseStatusException(BAD_REQUEST,
                "Message must be between 2 and " + inputLimit + " characters");
        }
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("message", normalized);
        Object mode = request.get("mode");
        if (mode != null) payload.put("mode", mode);
        Object turns = request.get("recent_turns");
        if (turns == null) turns = request.get("recent_history");
        if (turns != null) payload.put("recent_turns", turns);
        Object syntheticBeta = request.get("synthetic_beta");
        if (syntheticBeta == null) syntheticBeta = request.get("syntheticBeta");
        if (syntheticBeta != null) payload.put("synthetic_beta", syntheticBeta);
        if (generation) {
            Object sources = request.get("authorized_sources");
            if (sources == null) sources = request.get("authorizedSources");
            payload.put("authorized_sources", sources == null ? List.of() : sources);
        }
        return payload;
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

    public List<Map<String, Object>> listIndexedDocuments() {
        if (!isRagIngestConfigured()) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "RAG ingestion is not configured");
        }
        List<Map<String, Object>> all = new java.util.ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 200; page++) {
            String path = "/rag/sources?limit=1000" + (cursor == null ? "" : "&cursor="
                + URLEncoder.encode(cursor, StandardCharsets.UTF_8));
            Map<String, Object> response = exchange(
                HttpMethod.GET,
                URI.create(endpoint(path)),
                new HttpEntity<>(ragHeaders())
            );
            Object sources = response.get("sources");
            if (sources instanceof List<?> values) {
                all.addAll(objectMapper.convertValue(values, new TypeReference<List<Map<String, Object>>>() { }));
            }
            Object next = response.get("next_cursor");
            if (next == null || String.valueOf(next).isBlank()) {
                return all;
            }
            String nextCursor = String.valueOf(next);
            if (nextCursor.equals(cursor)) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI source pagination cursor repeated");
            }
            cursor = nextCursor;
        }
        throw new ResponseStatusException(BAD_GATEWAY, "AI source pagination did not complete");
    }

    public Map<String, Object> removeIndexedDocument(String sourceType, String sourceId) {
        return removeIndexedDocument(sourceType, sourceId, null, null);
    }

    public Map<String, Object> removeIndexedDocument(String sourceType, String sourceId, Long revision) {
        return removeIndexedDocument(sourceType, sourceId, revision, null);
    }

    public Map<String, Object> removeIndexedDocument(
        String sourceType,
        String sourceId,
        Long revision,
        String projectionKind
    ) {
        if (!isRagIngestConfigured()) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "RAG ingestion is not configured");
        }
        try {
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("source_type", sourceType);
            payload.put("source_id", sourceId);
            if (revision != null) payload.put("revision", revision);
            if (projectionKind != null && !projectionKind.isBlank()) {
                payload.put("projection_kind", projectionKind);
            }
            return exchange(
                HttpMethod.POST,
                URI.create(endpoint("/rag/delete")),
                new HttpEntity<>(objectMapper.writeValueAsString(payload), ragHeaders())
            );
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "RAG deletion could not be encoded", e);
        }
    }

    private HttpHeaders ragHeaders() {
        HttpHeaders headers = headers();
        headers.set("X-RAG-Ingest-Token", ragIngestToken);
        return headers;
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

    private Map<String, Object> postJson(String path, Map<String, Object> request) {
        ensureServiceAuthConfiguration();
        try {
            return exchange(
                HttpMethod.POST,
                URI.create(endpoint(path)),
                new HttpEntity<>(objectMapper.writeValueAsString(request), headers())
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

    private Map<String, Object> readChatSse(InputStream stream, ChatDeltaConsumer onDelta) throws IOException {
        if (stream == null) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service stream returned an empty response");
        }
        int responseLimit = maxResponseBytes > 0 ? maxResponseBytes : DEFAULT_MAX_RESPONSE_BYTES;
        SseBlock block = new SseBlock();
        Map<String, Object> done = null;
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int total = 0;
        int next;
        while ((next = stream.read()) != -1) {
            total++;
            if (total > responseLimit) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service response exceeded the configured limit");
            }
            if (next == '\n') {
                done = processSseLine(new String(line.toByteArray(), StandardCharsets.UTF_8), block, onDelta, done);
                line.reset();
            } else {
                line.write(next);
            }
        }
        if (line.size() > 0) {
            done = processSseLine(new String(line.toByteArray(), StandardCharsets.UTF_8), block, onDelta, done);
        }
        if (block.hasData()) {
            done = finishSseBlock(block, onDelta, done);
        }
        if (done == null) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service stream did not complete");
        }
        return done;
    }

    private Map<String, Object> processSseLine(
            String rawLine,
            SseBlock block,
            ChatDeltaConsumer onDelta,
            Map<String, Object> done) throws IOException {
        String line = rawLine.endsWith("\r") ? rawLine.substring(0, rawLine.length() - 1) : rawLine;
        if (line.isEmpty()) {
            return finishSseBlock(block, onDelta, done);
        }
        if (line.startsWith(":")) {
            return done;
        }
        if (line.startsWith("event:")) {
            block.eventName = line.substring("event:".length()).strip();
            return done;
        }
        if (line.startsWith("data:")) {
            String data = line.substring("data:".length());
            block.dataLines.add(data.startsWith(" ") ? data.substring(1) : data);
        }
        return done;
    }

    private Map<String, Object> finishSseBlock(
            SseBlock block,
            ChatDeltaConsumer onDelta,
            Map<String, Object> done) throws IOException {
        if (!block.hasData()) {
            block.reset();
            return done;
        }
        String data = String.join("\n", block.dataLines);
        String eventName = block.eventName == null || block.eventName.isBlank()
            ? "message" : block.eventName;
        block.reset();
        if ("error".equals(eventName)) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service stream failed");
        }
        if (done != null && ("delta".equals(eventName) || "done".equals(eventName))) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service stream continued after completion");
        }
        if ("delta".equals(eventName)) {
            if (!data.isEmpty() && onDelta != null) {
                onDelta.accept(data);
            }
            return done;
        }
        if ("done".equals(eventName)) {
            try {
                return objectMapper.readValue(data, new TypeReference<Map<String, Object>>() { });
            } catch (JsonProcessingException e) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service stream returned invalid JSON", e);
            }
        }
        return done;
    }

    private String validateQuery(String query) {
        if (query == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Search query is required");
        }
        String normalized = query.trim();
        int inputLimit = maxInputChars > 0 ? Math.min(maxInputChars, DEFAULT_MAX_INPUT_CHARS) : DEFAULT_MAX_INPUT_CHARS;
        if (normalized.isEmpty() || normalized.length() > inputLimit) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                "Search query must be between 1 and " + inputLimit + " characters"
            );
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
        // Render's `fromService.property: hostport` intentionally supplies a
        // private-network host:port without a scheme. Normalize that value at
        // the gateway boundary so URI.create receives an absolute URL while
        // preserving explicit http/https configuration for local and hosted
        // environments.
        if (!base.isEmpty() && !base.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*$")) {
            base = "http://" + base;
        }
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

    private static final class SseBlock {
        private String eventName = "message";
        private final List<String> dataLines = new ArrayList<>();

        private boolean hasData() {
            return !dataLines.isEmpty();
        }

        private void reset() {
            eventName = "message";
            dataLines.clear();
        }
    }
}
