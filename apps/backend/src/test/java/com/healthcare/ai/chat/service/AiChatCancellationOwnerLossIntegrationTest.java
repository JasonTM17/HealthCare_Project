package com.healthcare.ai.chat.service;

import com.healthcare.AbstractRedisIntegrationTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.chat.controller.InternalChatCancellationController;
import com.healthcare.ai.service.AiService;
import com.healthcare.auth.security.BffRequestVerifier;
import com.sun.net.httpserver.HttpServer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.spy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@TestPropertySource(properties = {
    "app.security.bff.service-token=test-bff-cancellation-token-32-bytes-minimum",
    "app.security.bff.required=true"
})
class AiChatCancellationOwnerLossIntegrationTest extends AbstractRedisIntegrationTest {

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private RedisConnectionFactory connectionFactory;

    @Autowired
    private ChatRequestCancellationRegistry owner;

    @Autowired
    private BffRequestVerifier bffVerifier;

    @Autowired
    @Qualifier("aiChatCancellationMessageListenerContainer")
    private RedisMessageListenerContainer ownerSubscription;

    @Test
    void acceptedCancellationIntentIsReconciledByOwnerPollingAfterPubSubLoss() throws Exception {
        String requestId = UUID.randomUUID().toString();
        StringRedisTemplate failingPublisher = spy(redis);
        doThrow(new IllegalStateException("synthetic Redis Pub/Sub failure"))
            .when(failingPublisher)
            .convertAndSend(eq(ChatRequestCancellationRegistry.CHANNEL), eq(requestId));
        ChatRequestCancellationRegistry nonOwner = new ChatRequestCancellationRegistry(failingPublisher, 180);
        MockMvc nonOwnerMvc = MockMvcBuilders.standaloneSetup(
            new InternalChatCancellationController(bffVerifier, nonOwner)).build();
        RedisMessageListenerContainer nonOwnerSubscription = listener(connectionFactory, nonOwner);
        long listenerCountBeforeNonOwner = awaitListenerCountAtLeast(redis, 1);
        nonOwnerSubscription.start();
        awaitListenerCount(redis, listenerCountBeforeNonOwner + 1);

        CountDownLatch providerStarted = new CountDownLatch(1);
        CountDownLatch providerDisconnected = new CountDownLatch(1);
        AtomicBoolean releaseProvider = new AtomicBoolean(false);
        HttpServer provider = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        provider.createContext("/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            providerStarted.countDown();
            try {
                exchange.sendResponseHeaders(200, 0);
                try (OutputStream output = exchange.getResponseBody()) {
                    while (!releaseProvider.get()) {
                        output.write(' ');
                        output.flush();
                        Thread.sleep(15);
                    }
                    output.write("{\"answer\":\"completed\"}".getBytes(StandardCharsets.UTF_8));
                }
            } catch (IOException exception) {
                providerDisconnected.countDown();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        provider.start();

        Future<Map<String, Object>> inFlight = null;
        ChatRequestCancellationRegistry.Registration registration = null;
        try (var executor = Executors.newSingleThreadExecutor()) {
            try {
                awaitListenerCount(redis, listenerCountBeforeNonOwner + 1);
                registration = owner.register(requestId);

                AiService client = new AiService(new RestTemplateBuilder(), new ObjectMapper());
                ReflectionTestUtils.setField(
                    client, "aiServiceUrl", "http://localhost:" + provider.getAddress().getPort());
                ReflectionTestUtils.setField(client, "aiServiceRuntime", "local");
                ReflectionTestUtils.setField(client, "allowUnauthenticatedLocal", true);
                ChatRequestCancellation ownerCancellation = registration.cancellation();
                inFlight = executor.submit(() -> client.chat(Map.of("message", "hello"), ownerCancellation));
                assertThat(providerStarted.await(3, TimeUnit.SECONDS)).isTrue();

                // Model the owner losing its Redis Pub/Sub subscription and the
                // non-owner's publish failing; the shared tombstone must still
                // let owner polling cancel the active provider call.
                ownerSubscription.stop();
                awaitListenerCount(redis, listenerCountBeforeNonOwner);

                long cancellationStartedAt = System.nanoTime();
                int httpStatus = nonOwnerMvc.perform(post(
                        "/api/v1/internal/ai/chat-cancellations/{requestId}", requestId)
                    .header(
                        BffRequestVerifier.CREDENTIAL_HEADER,
                        "test-bff-cancellation-token-32-bytes-minimum")
                    .header(BffRequestVerifier.ORIGINAL_ORIGIN_HEADER, "http://localhost:3000"))
                    .andReturn()
                    .getResponse()
                    .getStatus();

                long cancellationElapsedNanos = System.nanoTime() - cancellationStartedAt;
                long remainingBudgetNanos = TimeUnit.MILLISECONDS.toNanos(500) - cancellationElapsedNanos;
                boolean providerClosedWithinBudget = remainingBudgetNanos >= 0
                    && providerDisconnected.await(remainingBudgetNanos, TimeUnit.NANOSECONDS);
                Map<String, Object> observation = Map.of(
                    "httpStatus", httpStatus,
                    "sharedStateAtAcknowledgement", redis.opsForValue().get(
                        "healthcare:ai-chat:request:" + requestId),
                    "ownerCallback", ownerCancellation.isCancelled(),
                    "providerSocketClosedWithin500ms", providerClosedWithinBudget
                );
                assertThat(observation)
                    .as("204 confirms shared intent; owner polling must close the provider within 500ms of request dispatch")
                    .containsEntry("httpStatus", HttpStatus.NO_CONTENT.value())
                    .containsEntry("sharedStateAtAcknowledgement", "CANCELLED")
                    .containsEntry("ownerCallback", true)
                    .containsEntry("providerSocketClosedWithin500ms", true);
            } finally {
                releaseProvider.set(true);
                if (inFlight != null && !inFlight.isDone()) inFlight.cancel(true);
                if (registration != null) registration.close();
                redis.delete("healthcare:ai-chat:request:" + requestId);
                ownerSubscription.stop();
                nonOwnerSubscription.stop();
                provider.stop(0);
                ownerSubscription.start();
            }
        }
    }

    private static RedisMessageListenerContainer listener(
            RedisConnectionFactory connectionFactory,
            ChatRequestCancellationRegistry registry) {
        RedisMessageListenerContainer listener = new RedisMessageListenerContainer();
        listener.setConnectionFactory(connectionFactory);
        listener.setRecoveryInterval(Duration.ofMillis(100).toMillis());
        listener.addMessageListener(registry, new ChannelTopic(ChatRequestCancellationRegistry.CHANNEL));
        listener.afterPropertiesSet();
        return listener;
    }

    private static long awaitListenerCountAtLeast(StringRedisTemplate redis, long minimum) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            Long listeners = redis.convertAndSend(ChatRequestCancellationRegistry.CHANNEL, "subscription-probe");
            if (listeners != null && listeners >= minimum) return listeners;
            Thread.sleep(20);
        }
        throw new AssertionError("Expected at least " + minimum + " Redis cancellation listeners");
    }

    private static void awaitListenerCount(StringRedisTemplate redis, long expected) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            Long listeners = redis.convertAndSend(ChatRequestCancellationRegistry.CHANNEL, "subscription-probe");
            if (listeners != null && listeners == expected) return;
            Thread.sleep(20);
        }
        throw new AssertionError("Expected " + expected + " Redis cancellation listeners");
    }
}
