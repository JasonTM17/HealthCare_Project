package com.healthcare.ai.chat.service;

import com.healthcare.AbstractRedisIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.UUID;
import java.util.concurrent.CancellationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.spy;

class ChatRequestCancellationRegistryIntegrationTest extends AbstractRedisIntegrationTest {

    @Autowired
    private ChatRequestCancellationRegistry cancellations;

    @Autowired
    private StringRedisTemplate redis;

    @Test
    void cancellationFromAnotherRegistryStopsActiveRequestAndTombstoneWinsRegistrationRace() throws Exception {
        awaitCancellationSubscriber();
        ChatRequestCancellationRegistry otherInstance = new ChatRequestCancellationRegistry(redis, 180);
        String activeRequestId = UUID.randomUUID().toString();
        String earlyCancellationId = UUID.randomUUID().toString();

        try (ChatRequestCancellationRegistry.Registration registration = cancellations.register(activeRequestId)) {
            otherInstance.cancel(activeRequestId);

            awaitCancelled(registration.cancellation());
            assertThat(registration.cancellation().isCancelled()).isTrue();
            assertThatThrownBy(() -> cancellations.claimCommit(registration.cancellation()))
                .isInstanceOf(CancellationException.class);
        } finally {
            redis.delete(stateKey(activeRequestId));
        }

        try {
            otherInstance.cancel(earlyCancellationId);

            assertThatThrownBy(() -> cancellations.register(earlyCancellationId))
                .isInstanceOf(CancellationException.class);
        } finally {
            redis.delete(stateKey(earlyCancellationId));
        }
    }

    @Test
    void persistenceClaimWinsAConcurrentLateDisconnect() throws Exception {
        awaitCancellationSubscriber();
        ChatRequestCancellationRegistry otherInstance = new ChatRequestCancellationRegistry(redis, 180);
        String requestId = UUID.randomUUID().toString();

        try (ChatRequestCancellationRegistry.Registration registration = cancellations.register(requestId)) {
            cancellations.claimCommit(registration.cancellation());
            otherInstance.cancel(requestId);

            assertThat(registration.cancellation().isCancelled()).isFalse();
            cancellations.complete(registration.cancellation());
            assertThat(redis.opsForValue().get(stateKey(requestId))).isEqualTo("COMMITTED");
        } finally {
            redis.delete(stateKey(requestId));
        }
    }

    @Test
    void persistedCancellationIntentSurvivesMissingOrFailedPubSubDelivery() {
        String noListenerRequestId = UUID.randomUUID().toString();
        String publishFailureRequestId = UUID.randomUUID().toString();
        StringRedisTemplate bestEffortPublisher = spy(redis);
        doReturn(0L)
            .when(bestEffortPublisher)
            .convertAndSend(eq(ChatRequestCancellationRegistry.CHANNEL), eq(noListenerRequestId));
        doThrow(new IllegalStateException("synthetic Redis Pub/Sub failure"))
            .when(bestEffortPublisher)
            .convertAndSend(eq(ChatRequestCancellationRegistry.CHANNEL), eq(publishFailureRequestId));
        ChatRequestCancellationRegistry cancellationRequests = new ChatRequestCancellationRegistry(
            bestEffortPublisher,
            180);

        try {
            assertThatCode(() -> cancellationRequests.cancel(noListenerRequestId))
                .doesNotThrowAnyException();
            assertThat(redis.opsForValue().get(stateKey(noListenerRequestId))).isEqualTo("CANCELLED");

            assertThatCode(() -> cancellationRequests.cancel(publishFailureRequestId))
                .doesNotThrowAnyException();
            assertThat(redis.opsForValue().get(stateKey(publishFailureRequestId))).isEqualTo("CANCELLED");
        } finally {
            redis.delete(stateKey(noListenerRequestId));
            redis.delete(stateKey(publishFailureRequestId));
        }
    }

    private void awaitCancellationSubscriber() throws InterruptedException {
        long deadline = System.nanoTime() + java.time.Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            Long listeners = redis.convertAndSend(ChatRequestCancellationRegistry.CHANNEL, "not-a-request-id");
            if (listeners != null && listeners > 0) return;
            Thread.sleep(25);
        }
        throw new AssertionError("No Redis chat-cancellation listener became available");
    }

    private void awaitCancelled(ChatRequestCancellation cancellation) throws InterruptedException {
        long deadline = System.nanoTime() + java.time.Duration.ofSeconds(2).toNanos();
        while (!cancellation.isCancelled() && System.nanoTime() < deadline) {
            Thread.sleep(10);
        }
    }

    private static String stateKey(String requestId) {
        return "healthcare:ai-chat:request:" + requestId;
    }
}
