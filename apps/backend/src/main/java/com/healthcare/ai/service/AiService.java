package com.healthcare.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.ChatRequestCancellation;
import com.healthcare.observability.RequestTrace;
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
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.net.URI;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.util.concurrent.atomic.AtomicReference;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AiService {

    private static final int DEFAULT_MAX_INPUT_CHARS = 10_000;
    private static final int MIN_CHAT_INPUT_CHARS = 2;
    private static final int DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    /** Latch for the one-WARN-per-episode RAG fallback notice; see {@link #probeHealth}. */
    private final java.util.concurrent.atomic.AtomicBoolean ragFallbackWarningActive =
        new java.util.concurrent.atomic.AtomicBoolean(false);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient cancellableHttpClient;
    private final Duration upstreamTimeout;

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
        this(restTemplateBuilder, objectMapper, Duration.ofSeconds(1), Duration.ofSeconds(35));
    }

    @Autowired
    public AiService(
        RestTemplateBuilder restTemplateBuilder,
        ObjectMapper objectMapper,
        @Value("${ai.service.connect-timeout-ms:1000}") long connectTimeoutMs,
        @Value("${ai.service.read-timeout-ms:35000}") long readTimeoutMs
    ) {
        this(
            restTemplateBuilder,
            objectMapper,
            boundedDuration(connectTimeoutMs, Duration.ofSeconds(1)),
            boundedDuration(readTimeoutMs, Duration.ofSeconds(35))
        );
    }

    private AiService(
        RestTemplateBuilder restTemplateBuilder,
        ObjectMapper objectMapper,
        Duration connectTimeout,
        Duration readTimeout
    ) {
        this.restTemplate = restTemplateBuilder
            .requestFactory(() -> {
                SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                factory.setConnectTimeout(connectTimeout);
                factory.setReadTimeout(readTimeout);
                return factory;
            })
            .messageConverters(
                new ByteArrayHttpMessageConverter(),
                new StringHttpMessageConverter(StandardCharsets.UTF_8)
            )
            .build();
        this.objectMapper = objectMapper;
        this.cancellableHttpClient = HttpClient.newBuilder()
            .connectTimeout(connectTimeout)
            // FastAPI/Uvicorn rejects the cleartext h2c upgrade sent by the JDK's HTTP/2 default.
            .version(HttpClient.Version.HTTP_1_1)
            .build();
        this.upstreamTimeout = readTimeout;
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
        Object mode = request.get("mode");
        if (mode != null) {
            if (!(mode instanceof String rawMode)) {
                throw new ResponseStatusException(BAD_REQUEST, "mode is invalid");
            }
            String normalizedMode = rawMode.trim();
            try {
                ChatMode.valueOf(normalizedMode);
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(BAD_REQUEST, "mode is invalid", ex);
            }
            payload.put("mode", normalizedMode);
        }
        return postJson("/chat", payload);
    }

    /** Same server-owned public contract, with cooperative upstream cancellation for a live chat operation. */
    public Map<String, Object> chat(Map<String, Object> request, ChatRequestCancellation cancellation) {
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
        if (recentTurns == null) recentTurns = request.get("recent_history");
        payload.put("recent_turns", normalizeRecentTurns(recentTurns));
        Object publicSupportChat = request.get("public_support_chat");
        if (publicSupportChat == null) publicSupportChat = request.get("publicSupportChat");
        if (publicSupportChat != null) payload.put("public_support_chat", publicSupportChat);
        Object mode = request.get("mode");
        if (mode != null) {
            if (!(mode instanceof String rawMode)) throw new ResponseStatusException(BAD_REQUEST, "mode is invalid");
            try {
                payload.put("mode", ChatMode.valueOf(rawMode.trim()).name());
            } catch (IllegalArgumentException exception) {
                throw new ResponseStatusException(BAD_REQUEST, "mode is invalid", exception);
            }
        }
        return cancellableJsonRequest("/chat", payload, cancellation);
    }

    /**
     * The AI service enforces these bounds at its schema edge; enforcing them
     * here too turns an oversized/ill-typed relay payload into a 400 at the
     * Spring boundary instead of an opaque 502 after the cross-service hop.
     * Only map-shaped turns are accepted: every current caller (public chat
     * controller, conversation service) relays maps, and bean validation on
     * the public request already rejects null/blank fields before this point.
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
            if (!(rawTurn instanceof Map<?, ?> turn)) {
                throw new ResponseStatusException(BAD_REQUEST,
                    "recent_turns entries must be {role: user|assistant, content: string}");
            }
            String role = turn.get("role") instanceof String r ? r : null;
            String content = turn.get("content") instanceof String c ? c : null;
            if (role == null || (!role.equals("user") && !role.equals("assistant")) || content == null) {
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

    public Map<String, Object> retrieveChat(
            Map<String, Object> request,
            ChatRequestCancellation cancellation) {
        return cancellableJsonRequest(
            "/chat/retrieve", normalizePatientChatPayload(request, false), cancellation);
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

    public Map<String, Object> generateChat(
            Map<String, Object> request,
            ChatRequestCancellation cancellation) {
        return cancellableJsonRequest(
            "/chat/generate", normalizePatientChatPayload(request, true), cancellation);
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
        long startedAt = System.nanoTime();
        String outcome = "failed";
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
            outcome = "completed";
            return response;
        } catch (RestClientResponseException e) {
            log.warn("AI upstream returned HTTP {} for {}", e.getStatusCode().value(), "/chat/generate/stream");
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (RestClientException e) {
            log.warn("AI upstream stream request failed for {}: {}", "/chat/generate/stream", e.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI request could not be encoded", e);
        } finally {
            recordChatStage("/chat/generate/stream", outcome, startedAt);
        }
    }

    /** Cancellable internal SSE fetch; the completed, validated answer is still chunked only by Spring afterwards. */
    public Map<String, Object> generateChatStream(
            Map<String, Object> request,
            ChatDeltaConsumer onDelta,
            ChatRequestCancellation cancellation) {
        Map<String, Object> payload = normalizePatientChatPayload(request, true);
        long startedAt = System.nanoTime();
        String outcome = "failed";
        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            byte[] response = cancellableRequest("/chat/generate/stream", body, cancellation, true);
            Map<String, Object> decoded = readChatSse(
                new ByteArrayInputStream(response), onDelta);
            if (decoded == null || decoded.isEmpty()) {
                throw new ResponseStatusException(BAD_GATEWAY, "AI service stream returned an empty response");
            }
            outcome = "completed";
            return decoded;
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI request could not be encoded", exception);
        } catch (IOException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service stream returned invalid data", exception);
        } finally {
            recordChatStage("/chat/generate/stream", outcome, startedAt);
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
        Object topK = request.get("top_k");
        if (topK != null) {
            if (!(topK instanceof Number value) || value.intValue() < 1 || value.intValue() > 20) {
                throw new ResponseStatusException(BAD_REQUEST, "top_k must be between 1 and 20");
            }
            payload.put("top_k", topK);
        }
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
        Map<String, Object> health = probeHealth();
        return health != null
            && "ok".equals(health.get("status"))
            && Boolean.TRUE.equals(health.get("ready"));
    }

    /**
     * One bounded {@code /health} probe of the ai-service, returning the
     * parsed response body or {@code null} when the service is unreachable,
     * misconfigured or answered unparseable bytes. The Spring contract keeps
     * depending only on {@code status}/{@code ready}; the extra diagnostic
     * fields (notably {@code rag_fallback_active}) are read purely to raise a
     * single WARN per degraded episode — they never flip this deployment's
     * own health verdict, which stays an operator concern on the ai-service.
     */
    public Map<String, Object> probeHealth() {
        if (!hasServiceAuthConfiguration()) {
            return null;
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
                return null;
            }
            Map<String, Object> health = objectMapper.readValue(
                new String(response.getBody(), StandardCharsets.UTF_8),
                new TypeReference<Map<String, Object>>() { }
            );
            recordRagFallbackState(health.get("rag_fallback_active"));
            return health;
        } catch (RestClientException | JsonProcessingException e) {
            // Leave the latch untouched: while the service is unreachable we
            // neither repeat nor clear the fallback warning, so recovery does
            // not spam and a persistent episode is not silently forgotten.
            return null;
        }
    }

    /**
     * WARN once when the ai-service reports its RAG store degraded to the
     * in-memory fallback, and clear the latch on the first healthy report.
     * Health polling is frequent; a transition latch keeps this at one log
     * line per episode instead of one per probe.
     */
    private void recordRagFallbackState(Object ragFallbackActive) {
        boolean fallbackActive = Boolean.TRUE.equals(ragFallbackActive);
        if (fallbackActive) {
            if (ragFallbackWarningActive.compareAndSet(false, true)) {
                log.warn("AI service RAG backend degraded: serving from the in-memory fallback (SUPABASE_DB_URL or durable store unavailable)");
            }
        } else {
            ragFallbackWarningActive.set(false);
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

    private Map<String, Object> cancellableJsonRequest(
            String path,
            Map<String, Object> request,
            ChatRequestCancellation cancellation) {
        if (cancellation == null) throw new IllegalArgumentException("Chat cancellation context is required");
        ensureServiceAuthConfiguration();
        try {
            byte[] raw = cancellableRequest(
                path, objectMapper.writeValueAsBytes(request), cancellation, false);
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() { });
        } catch (IOException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned invalid JSON", exception);
        }
    }

    /**
     * Uses JDK HttpClient's cancellable future for patient/public chat work.
     * The response body is bounded while it is read, and cancellation closes
     * the in-flight connection before the caller can reach persistence.
     */
    private byte[] cancellableRequest(
            String path,
            byte[] body,
            ChatRequestCancellation cancellation,
            boolean eventStream) {
        cancellation.throwIfCancelled();
        long startedAt = System.nanoTime();
        String outcome = "failed";
        try {
            HttpHeaders headers = headers();
            if (eventStream) headers.setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(endpoint(path)))
                .timeout(upstreamTimeout)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
            headers.forEach((name, values) -> values.forEach(value -> requestBuilder.header(name, value)));

            CompletableFuture<HttpResponse<byte[]>> future = cancellableHttpClient.sendAsync(
                requestBuilder.build(),
                responseInfo -> new BoundedByteArraySubscriber(
                    maxResponseBytes > 0 ? maxResponseBytes : DEFAULT_MAX_RESPONSE_BYTES));
            AutoCloseable cancellationRegistration = cancellation.onCancel(() -> future.cancel(true));
            try {
                HttpResponse<byte[]> response = future.get();
                cancellation.throwIfCancelled();
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    log.warn("AI upstream returned HTTP {} for {}", response.statusCode(), path);
                    throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable");
                }
                byte[] raw = response.body();
                if (raw == null || raw.length == 0) {
                    throw new ResponseStatusException(BAD_GATEWAY, "AI service returned an empty response");
                }
                outcome = "completed";
                return raw;
            } finally {
                try {
                    cancellationRegistration.close();
                } catch (Exception ignored) {
                    // Listener removal is local bookkeeping only.
                }
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            cancellation.throwIfCancelled();
            throw new CancellationException("AI request was interrupted");
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof CancellationException) throw (CancellationException) cause;
            if (cause instanceof ResponseStatusException statusException) throw statusException;
            log.warn("AI upstream request failed for {}: {}", path,
                cause == null ? exception.getClass().getSimpleName() : cause.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", cause);
        } catch (CancellationException exception) {
            throw exception;
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("AI upstream request failed for {}: {}", path, exception.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", exception);
        } finally {
            recordChatStage(path, outcome, startedAt);
        }
    }

    private final class BoundedByteArraySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final int maxBytes;
        private final ByteArrayOutputStream body = new ByteArrayOutputStream();
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private final AtomicReference<Flow.Subscription> subscription = new AtomicReference<>();

        private BoundedByteArraySubscriber(int maxBytes) {
            this.maxBytes = maxBytes;
        }

        @Override
        public CompletionStage<byte[]> getBody() {
            return result;
        }

        @Override
        public void onSubscribe(Flow.Subscription candidate) {
            if (!subscription.compareAndSet(null, candidate)) {
                candidate.cancel();
                return;
            }
            candidate.request(1);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            try {
                for (ByteBuffer buffer : buffers) {
                    if (buffer.remaining() > maxBytes - body.size()) {
                        Flow.Subscription current = subscription.get();
                        if (current != null) current.cancel();
                        result.completeExceptionally(new IOException("AI response exceeded the configured limit"));
                        return;
                    }
                    byte[] chunk = new byte[buffer.remaining()];
                    buffer.get(chunk);
                    body.writeBytes(chunk);
                }
                Flow.Subscription current = subscription.get();
                if (current != null) current.request(1);
            } catch (RuntimeException exception) {
                Flow.Subscription current = subscription.get();
                if (current != null) current.cancel();
                result.completeExceptionally(exception);
            }
        }

        @Override
        public void onError(Throwable throwable) {
            result.completeExceptionally(throwable);
        }

        @Override
        public void onComplete() {
            result.complete(body.toByteArray());
        }
    }

    private Map<String, Object> exchange(HttpMethod method, URI uri, HttpEntity<?> requestEntity) {
        long startedAt = System.nanoTime();
        String outcome = "failed";
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
            Map<String, Object> decoded = objectMapper.readValue(
                body, new TypeReference<Map<String, Object>>() { }
            );
            outcome = "completed";
            return decoded;
        } catch (RestClientResponseException e) {
            log.warn("AI upstream returned HTTP {} for {}", e.getStatusCode().value(), uri.getPath());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (RestClientException e) {
            log.warn("AI upstream request failed for {}: {}", uri.getPath(), e.getClass().getSimpleName());
            throw new ResponseStatusException(BAD_GATEWAY, "AI service is unavailable", e);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned invalid JSON", e);
        } finally {
            recordChatStage(uri.getPath(), outcome, startedAt);
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
        String requestId = RequestTrace.currentId();
        if (requestId != null) {
            headers.set(RequestTrace.HEADER, requestId);
        }
        if (aiServiceToken != null && !aiServiceToken.isBlank()) {
            headers.set("X-AI-Service-Token", aiServiceToken);
        }
        return headers;
    }

    private void recordChatStage(String path, String outcome, long startedAt) {
        String stage = switch (path) {
            case "/chat" -> "public-generation";
            case "/chat/retrieve" -> "retrieval";
            case "/chat/generate" -> "generation";
            case "/chat/generate/stream" -> "validated-chunk-generation";
            default -> null;
        };
        if (stage == null) return;
        String requestId = RequestTrace.currentId();
        if (requestId == null) return;
        long durationMillis = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        log.info(
            "AI chat stage requestId={} stage={} outcome={} durationMs={}",
            requestId, stage, outcome, durationMillis
        );
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
