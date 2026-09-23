package com.healthcare.auth.security;

import com.healthcare.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthRateLimiterTest {

    private static final String BFF_TOKEN = "0123456789abcdef0123456789abcdef";

    @Test
    void ipBucketKeysOnTrustedClientLiteralNotRemoteAddress() {
        RecordingRedis redis = new RecordingRedis();
        AuthRateLimiter limiter = limiter(redis.template(), false, 100);
        String operation = "t2-ip-" + UUID.randomUUID();

        limiter.check(trustedRequest("10.0.0.1", "203.0.113.10"), null, operation);
        limiter.check(trustedRequest("10.0.0.1", "203.0.113.11"), null, operation);
        limiter.check(trustedRequest("10.0.0.1", "203.0.113.10"), null, operation);

        List<String> ipKeys = redis.ipKeys(operation);
        assertThat(ipKeys).hasSize(3);
        assertThat(ipKeys.get(0))
            .isEqualTo("healthcare:rate-limit:auth:" + operation + ":ip:"
                + digest16("ipv4:203.0.113.10"))
            .isNotEqualTo("healthcare:rate-limit:auth:" + operation + ":ip:" + digest16("10.0.0.1"));
        assertThat(ipKeys.get(1)).isNotEqualTo(ipKeys.get(0));
        assertThat(ipKeys.get(2)).isEqualTo(ipKeys.get(0));
    }

    @Test
    void untrustedClientIpHeaderFallsBackToRemoteAddress() {
        RecordingRedis redis = new RecordingRedis();
        AuthRateLimiter limiter = limiter(redis.template(), false, 100);
        String operation = "t2-untrusted-" + UUID.randomUUID();

        MockHttpServletRequest forged = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        forged.setRemoteAddr("10.0.0.9");
        forged.addHeader(BffRequestVerifier.CLIENT_IP_HEADER, "203.0.113.99");
        limiter.check(forged, null, operation);

        assertThat(redis.ipKeys(operation).getFirst())
            .isEqualTo("healthcare:rate-limit:auth:" + operation + ":ip:" + digest16("10.0.0.9"));
    }

    @Test
    void distinctTrustedClientsBehindOneProxyGetIndependentBuckets() {
        RecordingRedis redis = new RecordingRedis();
        AuthRateLimiter limiter = limiter(redis.template(), false, 1);
        String operation = "t2-shared-proxy-" + UUID.randomUUID();

        // Same socket address (the Render proxy), two different end clients.
        assertThatCode(() -> limiter.check(trustedRequest("10.0.0.2", "203.0.113.20"), null, operation))
            .doesNotThrowAnyException();
        assertThatCode(() -> limiter.check(trustedRequest("10.0.0.2", "203.0.113.21"), null, operation))
            .doesNotThrowAnyException();
        // Repeating one client exhausts only that client's bucket.
        assertThatThrownBy(() -> limiter.check(trustedRequest("10.0.0.2", "203.0.113.20"), null, operation))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Too many requests");
    }

    @Test
    void redisRequiredFailsClosedAndNeverDeletesTheSharedKey() {
        RecordingRedis redis = new RecordingRedis();
        redis.failIncrement();
        AuthRateLimiter limiter = limiter(redis.template(), true, 100);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("10.0.0.3");

        assertThatThrownBy(() -> limiter.check(request, "locked.t3@example.com",
            "t3-required-" + UUID.randomUUID()))
            .isInstanceOf(BusinessException.class)
            .satisfies(failure -> {
                assertThat(((BusinessException) failure).getStatus()).isEqualTo(503);
                assertThat(((BusinessException) failure).getCode())
                    .isEqualTo(com.healthcare.exception.ErrorCodes.SERVICE_UNAVAILABLE);
            });

        verify(redis.template(), never()).delete(anyString());
    }

    @Test
    void withoutRedisRequiredTheFallbackCountsLocallyAndNeverDeletesTheSharedKey() {
        RecordingRedis redis = new RecordingRedis();
        redis.failIncrement();
        AuthRateLimiter limiter = limiter(redis.template(), false, 1);
        String operation = "t3-fallback-" + UUID.randomUUID();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("10.0.0.4");

        // The bounded in-memory window takes over without resetting Redis.
        assertThatCode(() -> limiter.check(request, null, operation))
            .doesNotThrowAnyException();
        assertThatThrownBy(() -> limiter.check(request, null, operation))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Too many requests");

        verify(redis.template(), never()).delete(anyString());
    }

    private AuthRateLimiter limiter(StringRedisTemplate redis, boolean redisRequired, int ipLimit) {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.bff.service-token", BFF_TOKEN);
        return new AuthRateLimiter(
            redis, new BffRequestVerifier(environment), true, Duration.ofMinutes(15), ipLimit, 5,
            redisRequired);
    }

    private MockHttpServletRequest trustedRequest(String remoteAddress, String clientIp) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddress);
        request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, BFF_TOKEN);
        request.addHeader(BffRequestVerifier.CLIENT_IP_HEADER, clientIp);
        return request;
    }

    private String digest16(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes, 0, 16);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    /**
     * Shared Redis stub: increments keep per-key counters so repeat calls of
     * the same bucket advance the count exactly like INCR.
     */
    private static final class RecordingRedis {
        private final StringRedisTemplate template = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        private final ValueOperations<String, String> values = mock(ValueOperations.class);
        private final Map<String, Long> counters = new HashMap<>();
        private final List<String> calls = new ArrayList<>();
        private boolean failing;

        RecordingRedis() {
            when(template.opsForValue()).thenReturn(values);
            when(values.increment(any(String.class))).thenAnswer(invocation -> {
                String key = invocation.getArgument(0);
                calls.add(key);
                if (failing) {
                    throw new RedisConnectionFailureException("synthetic outage");
                }
                return counters.merge(key, 1L, Long::sum);
            });
            when(template.getExpire(any(String.class))).thenReturn(60L);
        }

        void failIncrement() {
            failing = true;
        }

        List<String> ipKeys(String operation) {
            String prefix = "healthcare:rate-limit:auth:" + operation + ":ip:";
            return calls.stream().filter(key -> key.startsWith(prefix)).toList();
        }

        StringRedisTemplate template() {
            return template;
        }
    }
}
