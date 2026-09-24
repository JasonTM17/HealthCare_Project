package com.healthcare.ai.chat.service;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatRequestCancellationReconciliationTest {

    @Test
    void missingActiveStateCancelsLocalProviderAndRejectsCommit() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.multiGet(anyCollection())).thenReturn(Collections.singletonList(null));

        ChatRequestCancellationRegistry registry = new ChatRequestCancellationRegistry(redis, 180);
        ChatRequestCancellation cancellation = seedActiveRequest(registry);
        AtomicBoolean providerCancelled = new AtomicBoolean();
        cancellation.onCancel(() -> providerCancelled.set(true));

        registry.reconcileActiveRequests();

        assertThat(cancellation.isCancelled()).isTrue();
        assertThat(providerCancelled).isTrue();
        assertThatThrownBy(() -> registry.claimCommit(cancellation))
            .isInstanceOf(CancellationException.class);
    }

    @Test
    void redisReadFailureCancelsLocalProviderAndRejectsCommit() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenThrow(new RedisConnectionFailureException("synthetic outage"));

        ChatRequestCancellationRegistry registry = new ChatRequestCancellationRegistry(redis, 180);
        ChatRequestCancellation cancellation = seedActiveRequest(registry);
        AtomicBoolean providerCancelled = new AtomicBoolean();
        cancellation.onCancel(() -> providerCancelled.set(true));

        registry.reconcileActiveRequests();

        assertThat(cancellation.isCancelled()).isTrue();
        assertThat(providerCancelled).isTrue();
        assertThatThrownBy(() -> registry.claimCommit(cancellation))
            .isInstanceOf(CancellationException.class);
    }

    @Test
    void activeAndCommitWinningStatesDoNotCancelTheOwnerContext() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.multiGet(anyCollection())).thenReturn(List.of("ACTIVE", "COMMITTING", "COMMITTED"));

        ChatRequestCancellationRegistry registry = new ChatRequestCancellationRegistry(redis, 180);
        List<ChatRequestCancellation> contexts = List.of(
            seedActiveRequest(registry), seedActiveRequest(registry), seedActiveRequest(registry));

        registry.reconcileActiveRequests();

        assertThat(contexts).allSatisfy(context -> assertThat(context.isCancelled()).isFalse());
    }

    private static ChatRequestCancellation seedActiveRequest(ChatRequestCancellationRegistry registry) {
        String requestId = UUID.randomUUID().toString();
        ChatRequestCancellation cancellation = new ChatRequestCancellation(requestId);
        activeRequests(registry).put(requestId, cancellation);
        return cancellation;
    }

    @SuppressWarnings("unchecked")
    private static ConcurrentMap<String, ChatRequestCancellation> activeRequests(
            ChatRequestCancellationRegistry registry) {
        return (ConcurrentMap<String, ChatRequestCancellation>) ReflectionTestUtils.getField(registry, "active");
    }
}
