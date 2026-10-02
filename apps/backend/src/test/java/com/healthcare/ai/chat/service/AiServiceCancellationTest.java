package com.healthcare.ai.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.service.AiService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;

class AiServiceCancellationTest {

    @Test
    void cancellableClientUsesHttp11WhenFastApiRejectsH2cUpgrade() throws Exception {
        AtomicReference<String> upgradeHeader = new AtomicReference<>();
        HttpServer aiService = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        aiService.createContext("/chat", exchange -> {
            upgradeHeader.set(exchange.getRequestHeaders().getFirst("Upgrade"));
            exchange.getRequestBody().readAllBytes();
            if ("h2c".equalsIgnoreCase(upgradeHeader.get())) {
                exchange.sendResponseHeaders(400, -1);
            } else {
                byte[] response = "{\"answer\":\"Hello\"}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.length);
                try (OutputStream output = exchange.getResponseBody()) {
                    output.write(response);
                }
            }
            exchange.close();
        });
        aiService.start();

        AiService client = new AiService(new RestTemplateBuilder(), new ObjectMapper());
        ReflectionTestUtils.setField(
            client, "aiServiceUrl", "http://localhost:" + aiService.getAddress().getPort());
        ReflectionTestUtils.setField(client, "aiServiceRuntime", "local");
        ReflectionTestUtils.setField(client, "allowUnauthenticatedLocal", true);
        ChatRequestCancellation cancellation = new ChatRequestCancellation(UUID.randomUUID().toString());

        try {
            assertThat(client.chat(Map.of("message", "hello"), cancellation))
                .containsEntry("answer", "Hello");
            assertThat(upgradeHeader.get()).isNull();
        } finally {
            aiService.stop(0);
        }
    }

    @Test
    void cancellationClosesTheInFlightSpringToAiServiceSocket() throws Exception {
        CountDownLatch providerStarted = new CountDownLatch(1);
        CountDownLatch providerDisconnected = new CountDownLatch(1);
        AtomicBoolean releaseProvider = new AtomicBoolean(false);
        HttpServer aiService = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        aiService.createContext("/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            providerStarted.countDown();
            try {
                exchange.sendResponseHeaders(200, 0);
                try (OutputStream output = exchange.getResponseBody()) {
                    while (!releaseProvider.get()) {
                        output.write(" ".getBytes(StandardCharsets.UTF_8));
                        output.flush();
                        Thread.sleep(20);
                    }
                }
            } catch (IOException exception) {
                providerDisconnected.countDown();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        aiService.start();

        AiService client = new AiService(new RestTemplateBuilder(), new ObjectMapper());
        ReflectionTestUtils.setField(
            client, "aiServiceUrl", "http://localhost:" + aiService.getAddress().getPort());
        ReflectionTestUtils.setField(client, "aiServiceRuntime", "local");
        ReflectionTestUtils.setField(client, "allowUnauthenticatedLocal", true);
        ChatRequestCancellation cancellation = new ChatRequestCancellation(UUID.randomUUID().toString());

        try (var executor = Executors.newSingleThreadExecutor()) {
            var inFlight = executor.submit(() -> client.chat(Map.of("message", "hello"), cancellation));
            try {
                assertThat(providerStarted.await(2, TimeUnit.SECONDS)).isTrue();
                cancellation.cancel();

                assertThatThrownBy(() -> inFlight.get(2, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(java.util.concurrent.CancellationException.class);
                assertThat(providerDisconnected.await(2, TimeUnit.SECONDS)).isTrue();
            } finally {
                releaseProvider.set(true);
                inFlight.cancel(true);
            }
        } finally {
            releaseProvider.set(true);
            aiService.stop(0);
        }
    }

    // ---------------------------------------------------------------------------
    // Chat-scoped upstream budgets and the bounded response-future wait (D1/D2).
    // ---------------------------------------------------------------------------

    /**
     * The per-request upstream timeout carries the chat-scoped budgets for the
     * patient-chat stages while every other cancellable call (the public
     * single-call /chat endpoint here) keeps the global read timeout.
     */
    @Test
    void chatStageRequestsCarryTheirScopedUpstreamBudgets() throws Exception {
        HttpServer upstream = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        upstream.createContext("/chat/retrieve", exchange ->
            respondJson(exchange, "{\"candidates\":[]}", "application/json"));
        upstream.createContext("/chat/generate", exchange ->
            respondJson(exchange, "{\"answer\":\"ok\"}", "application/json"));
        upstream.createContext("/chat/generate/stream", exchange ->
            respondJson(exchange, "event: done\ndata: {\"answer\":\"ok\"}\n\n", "text/event-stream"));
        upstream.createContext("/chat", exchange ->
            respondJson(exchange, "{\"answer\":\"Hello\"}", "application/json"));
        upstream.start();

        AiService client = new AiService(new RestTemplateBuilder(), new ObjectMapper());
        ReflectionTestUtils.setField(
            client, "aiServiceUrl", "http://localhost:" + upstream.getAddress().getPort());
        ReflectionTestUtils.setField(client, "aiServiceRuntime", "local");
        ReflectionTestUtils.setField(client, "allowUnauthenticatedLocal", true);
        RecordingHttpClient recording = new RecordingHttpClient(
            (HttpClient) ReflectionTestUtils.getField(client, "cancellableHttpClient"));
        ReflectionTestUtils.setField(client, "cancellableHttpClient", recording);
        ChatRequestCancellation cancellation = new ChatRequestCancellation(UUID.randomUUID().toString());

        try {
            Map<String, Object> message = Map.of("message", "hello");

            assertThat(client.retrieveChat(message, cancellation)).isNotEmpty();
            assertThat(client.generateChat(message, cancellation)).isNotEmpty();
            assertThat(client.generateChatStream(message, delta -> { }, cancellation)).isNotEmpty();
            assertThat(client.chat(message, cancellation)).isNotEmpty();

            assertThat(recording.requests).hasSize(4);
            // retrieve -> chat-retrieve budget (6s)
            assertThat(recording.requests.get(0).timeout())
                .isEqualTo(Optional.of(Duration.ofMillis(6000)));
            // generate -> chat-generate budget (18s)
            assertThat(recording.requests.get(1).timeout())
                .isEqualTo(Optional.of(Duration.ofMillis(18000)));
            // generate/stream -> chat-generate budget (18s)
            assertThat(recording.requests.get(2).timeout())
                .isEqualTo(Optional.of(Duration.ofMillis(18000)));
            // public /chat (and search/triage/rag admin via RestTemplate) -> global 35s
            assertThat(recording.requests.get(3).timeout())
                .isEqualTo(Optional.of(Duration.ofSeconds(35)));
        } finally {
            upstream.stop(0);
        }
    }

    /**
     * D1: the JDK request timeout bounds only response-header receipt, so an
     * upstream that answers headers and then stalls the body used to pin the
     * calling thread on an unbounded {@code future.get()} forever. The wait is
     * now bounded at the per-request budget + fixed slack: the future is
     * cancelled, the socket is closed towards the provider, and the failure is
     * the same 502 BAD_GATEWAY "AI service is unavailable" as any other
     * upstream unavailability.
     */
    @Test
    void stalledUpstreamBodyFailsWithinTheChatBudgetAndCancelsTheFuture() throws Exception {
        CountDownLatch providerStarted = new CountDownLatch(1);
        CountDownLatch providerDisconnected = new CountDownLatch(1);
        AtomicBoolean releaseProvider = new AtomicBoolean(false);
        HttpServer upstream = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        upstream.createContext("/chat/generate", exchange -> {
            exchange.getRequestBody().readAllBytes();
            providerStarted.countDown();
            try {
                // Headers immediately, then a body that never ends.
                exchange.sendResponseHeaders(200, 0);
                try (OutputStream output = exchange.getResponseBody()) {
                    while (!releaseProvider.get()) {
                        output.write(" ".getBytes(StandardCharsets.UTF_8));
                        output.flush();
                        Thread.sleep(20);
                    }
                }
            } catch (IOException exception) {
                providerDisconnected.countDown();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        upstream.start();

        // Generate budget 1000ms -> bounded future wait = 1000ms + 2s slack;
        // headers arrive well inside the budget so the stall is body-phase.
        AiService client = new AiService(
            new RestTemplateBuilder(), new ObjectMapper(), 1000, 35000, 60000, 1000);
        ReflectionTestUtils.setField(
            client, "aiServiceUrl", "http://localhost:" + upstream.getAddress().getPort());
        ReflectionTestUtils.setField(client, "aiServiceRuntime", "local");
        ReflectionTestUtils.setField(client, "allowUnauthenticatedLocal", true);
        RecordingHttpClient recording = new RecordingHttpClient(
            (HttpClient) ReflectionTestUtils.getField(client, "cancellableHttpClient"));
        ReflectionTestUtils.setField(client, "cancellableHttpClient", recording);
        ChatRequestCancellation cancellation = new ChatRequestCancellation(UUID.randomUUID().toString());

        long startedAt = System.nanoTime();
        try (var executor = Executors.newSingleThreadExecutor()) {
            var inFlight = executor.submit(
                () -> client.generateChat(Map.of("message", "hello"), cancellation));
            try {
                assertThat(providerStarted.await(2, TimeUnit.SECONDS)).isTrue();

                assertThatThrownBy(() -> inFlight.get(10, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(ResponseStatusException.class)
                    .cause()
                    .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(BAD_GATEWAY))
                    .hasMessageContaining("AI service is unavailable");

                long elapsedMillis = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
                // Bounded wait: without the fix the calling thread hangs forever.
                assertThat(elapsedMillis).isLessThan(7000);
                // The future itself was cancelled, not merely abandoned.
                assertThat(recording.futures.get(0).cancelRequested).isTrue();
                // The in-flight socket was closed towards the provider.
                assertThat(providerDisconnected.await(2, TimeUnit.SECONDS)).isTrue();
            } finally {
                releaseProvider.set(true);
                inFlight.cancel(true);
            }
        } finally {
            releaseProvider.set(true);
            upstream.stop(0);
        }
    }

    private static void respondJson(HttpExchange exchange, String body, String contentType) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(200, response.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(response);
        }
    }

    /** Delegating HttpClient that records the requests sent and their futures. */
    private static final class RecordingHttpClient extends HttpClient {
        private final HttpClient delegate;
        private final List<HttpRequest> requests = new CopyOnWriteArrayList<>();
        private final List<RecordingFuture<?>> futures = new CopyOnWriteArrayList<>();

        private RecordingHttpClient(HttpClient delegate) {
            this.delegate = delegate;
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return delegate.cookieHandler();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return delegate.connectTimeout();
        }

        @Override
        public Redirect followRedirects() {
            return delegate.followRedirects();
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return delegate.proxy();
        }

        @Override
        public javax.net.ssl.SSLContext sslContext() {
            return delegate.sslContext();
        }

        @Override
        public javax.net.ssl.SSLParameters sslParameters() {
            return delegate.sslParameters();
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return delegate.authenticator();
        }

        @Override
        public Optional<Executor> executor() {
            return delegate.executor();
        }

        @Override
        public Version version() {
            return delegate.version();
        }

        @Override
        public <T> HttpResponse<T> send(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler) throws IOException, InterruptedException {
            requests.add(request);
            return delegate.send(request, responseBodyHandler);
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler) {
            requests.add(request);
            CompletableFuture<HttpResponse<T>> delegateFuture =
                delegate.sendAsync(request, responseBodyHandler);
            RecordingFuture<HttpResponse<T>> recording = new RecordingFuture<>(delegateFuture);
            futures.add(recording);
            delegateFuture.whenComplete((response, error) -> {
                if (error != null) {
                    recording.completeExceptionally(error);
                } else {
                    recording.complete(response);
                }
            });
            return recording;
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            requests.add(request);
            return delegate.sendAsync(request, responseBodyHandler, pushPromiseHandler);
        }
    }

    /** Tracks whether {@code cancel(mayInterruptIfRunning)} was requested on the response future. */
    private static final class RecordingFuture<T> extends CompletableFuture<T> {
        private final CompletableFuture<T> delegate;
        private final AtomicBoolean cancelRequested = new AtomicBoolean(false);

        private RecordingFuture(CompletableFuture<T> delegate) {
            this.delegate = delegate;
        }

        @Override
        public boolean cancel(boolean mayInterruptIfRunning) {
            cancelRequested.set(true);
            // Forward so the real exchange (and its socket) is torn down too.
            delegate.cancel(mayInterruptIfRunning);
            return super.cancel(mayInterruptIfRunning);
        }
    }
}
