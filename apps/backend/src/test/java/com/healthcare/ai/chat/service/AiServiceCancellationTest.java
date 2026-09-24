package com.healthcare.ai.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.service.AiService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
}
