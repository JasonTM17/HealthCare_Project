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

    @Test
    void legacyRegistrationCannotReviveALeaseAfterItsLogicalDeadline() throws Exception {
        String requestId = UUID.randomUUID().toString();
        String permit = cancellations.openLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseBinding.publicChat());
        assertThat(permit).isNotBlank();

        Thread.sleep(ChatRequestCancellationRegistry.LEASE_TTL_MILLIS + 100);

        try {
            assertThatThrownBy(() -> {
                try (var registration = cancellations.register(requestId)) {
                    throw new IllegalArgumentException("expired lease was revived as a legacy request");
                }
            }).isInstanceOf(IllegalStateException.class);
            assertThat(redis.opsForValue().get(stateKey(requestId))).isNotEqualTo("ACTIVE");
            assertThat(redis.getExpire(stateKey(requestId), java.util.concurrent.TimeUnit.MILLISECONDS))
                .isGreaterThan(150_000L);
        } finally {
            redis.delete(stateKey(requestId));
        }
    }

    @Test
    void renewalPermitRotatesOnceAndCannotCrossChatScopes() {
        String requestId = UUID.randomUUID().toString();
        String permit = cancellations.openLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseBinding.publicChat());
        String nextPermit = cancellations.renewLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseScope.PUBLIC_CHAT,
            permit);

        assertThatThrownBy(() -> cancellations.renewLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseScope.PUBLIC_CHAT,
            permit)).isInstanceOf(CancellationException.class);

        assertThatThrownBy(() -> cancellations.renewLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseScope.PATIENT,
            nextPermit)).isInstanceOf(CancellationException.class);
        assertThat(cancellations.renewLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseScope.PUBLIC_CHAT,
            nextPermit)).isNotBlank();
        redis.delete(stateKey(requestId));
    }

    @Test
    void patientCommitRequiresTheExactLeaseBindingAndCommitWinsLateCancel() throws Exception {
        ChatRequestCancellationRegistry otherInstance = new ChatRequestCancellationRegistry(redis, 180);
        String requestId = UUID.randomUUID().toString();
        UUID patientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        ChatRequestCancellationRegistry.LeaseBinding binding =
            ChatRequestCancellationRegistry.LeaseBinding.patient(patientId, conversationId, "chat-lease-0001");
        cancellations.openLease(requestId, binding);

        try (var registration = cancellations.registerBffLease(requestId, binding)) {
            ChatRequestCancellationRegistry.LeaseBinding wrongConversation =
                ChatRequestCancellationRegistry.LeaseBinding.patient(
                    patientId, UUID.randomUUID(), "chat-lease-0001");
            assertThatThrownBy(() -> cancellations.claimCommit(requestId, wrongConversation))
                .isInstanceOf(CancellationException.class);

            cancellations.claimCommit(requestId, binding);
            otherInstance.cancel(requestId);
            assertThat(registration.cancellation().isCancelled()).isFalse();
            cancellations.complete(registration.cancellation());
            assertThat(redis.opsForValue().get(stateKey(requestId))).isEqualTo("COMMITTED");
        } finally {
            redis.delete(stateKey(requestId));
        }
    }

    @Test
    void ownerPollingCancelsProviderWhenLeaseExpiresWithoutCancellationPost() throws Exception {
        String requestId = UUID.randomUUID().toString();
        ChatRequestCancellationRegistry.LeaseBinding binding =
            ChatRequestCancellationRegistry.LeaseBinding.publicChat();
        cancellations.openLease(requestId, binding);
        var registration = cancellations.registerBffLease(requestId, binding);
        java.util.concurrent.CountDownLatch stopped = new java.util.concurrent.CountDownLatch(1);
        registration.cancellation().onCancel(stopped::countDown);

        try {
            assertThat(stopped.await(4, java.util.concurrent.TimeUnit.SECONDS))
                .as("owner poll must observe Redis lease expiry promptly")
                .isTrue();
            assertThat(redis.opsForValue().get(stateKey(requestId))).isEqualTo("CANCELLED");
            assertThatThrownBy(() -> cancellations.claimCommit(requestId))
                .isInstanceOf(CancellationException.class);
        } finally {
            registration.close();
            redis.delete(stateKey(requestId));
        }
    }

    @Test
    void malformedOrUnknownLeaseRecordsFailClosedInsteadOfStartingProviderWork() {
        String requestId = UUID.randomUUID().toString();
        redis.opsForValue().set(
            stateKey(requestId),
            "{\"version\":99,\"state\":\"ACTIVE\",\"scope\":\"PUBLIC_CHAT\"}",
            java.time.Duration.ofSeconds(180));

        assertThatThrownBy(() -> cancellations.registerBffLease(
            requestId,
            ChatRequestCancellationRegistry.LeaseBinding.publicChat()))
            .isInstanceOf(CancellationException.class);
        assertThat(redis.opsForValue().get(stateKey(requestId))).isEqualTo("CANCELLED");
        redis.delete(stateKey(requestId));
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
