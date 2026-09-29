package com.healthcare.appointment.security;

import com.healthcare.auth.security.BffRequestVerifier;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BookingRateLimiterTest {

    private static final String BFF_TOKEN = "0123456789abcdef0123456789abcdef";

    @org.junit.jupiter.api.BeforeEach
    void clearFallbackEntries() throws Exception {
        fallbackMap().clear();
    }

    @org.junit.jupiter.api.AfterEach
    void clearFallbackEntriesAfterEach() throws Exception {
        fallbackMap().clear();
    }

    @Test
    void disabledLimiterSkipsRedisAndFallbackCounters() {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);

        new BookingRateLimiter(redisTemplate, false).check("hold", null, "0907000199");

        verifyNoInteractions(redisTemplate);
    }

    @Test
    void removesRedisCountersWhenExpiryCannotBeEstablished() {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        HttpServletRequest request = mock(HttpServletRequest.class);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(redisTemplate.getExpire(anyString())).thenReturn(-1L);
        when(redisTemplate.expire(anyString(), any(Duration.class))).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");

        new BookingRateLimiter(redisTemplate).check("confirm", request, "APT-EXAMPLE");

        verify(redisTemplate, atLeast(2)).delete(anyString());
    }

    @Test
    void rejectsNewFallbackKeysOnceTheAdmissionCapIsReached() throws Exception {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        HttpServletRequest request = mock(HttpServletRequest.class);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenThrow(new RuntimeException("Redis unavailable"));
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");

        Instant now = Instant.now();
        for (int index = 0; index < 10_000; index++) {
            fallbackMap().put("healthcare:rate-limit:booking:confirm:seed:" + index, newWindow(now, 1L));
        }

        assertThat(fallbackMap()).hasSize(10_000);
        assertThatThrownBy(() -> new BookingRateLimiter(redisTemplate).check("confirm", request, null))
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
            );
    }

    @Test
    void ipBucketKeysOnTrustedClientLiteralNotRemoteAddress() {
        RecordingRedis redis = new RecordingRedis();
        BookingRateLimiter limiter = limiter(redis.template(), false);
        String operation = "hold";

        // Same socket address (the BFF proxy), two different end clients.
        limiter.check(operation, trustedRequest("10.0.0.1", "203.0.113.10"), null);
        limiter.check(operation, trustedRequest("10.0.0.1", "203.0.113.11"), null);
        limiter.check(operation, trustedRequest("10.0.0.1", "203.0.113.10"), null);

        List<String> ipKeys = redis.ipKeys(operation);
        assertThat(ipKeys).hasSize(3);
        assertThat(ipKeys.get(0))
            .isEqualTo("healthcare:rate-limit:booking:" + operation + ":ip:"
                + digest16("ipv4:203.0.113.10"))
            .isNotEqualTo("healthcare:rate-limit:booking:" + operation + ":ip:" + digest16("10.0.0.1"));
        assertThat(ipKeys.get(1)).isNotEqualTo(ipKeys.get(0));
        assertThat(ipKeys.get(2)).isEqualTo(ipKeys.get(0));
    }

    @Test
    void untrustedClientIpHeaderFallsBackToRemoteAddress() {
        RecordingRedis redis = new RecordingRedis();
        BookingRateLimiter limiter = limiter(redis.template(), false);

        MockHttpServletRequest forged = new MockHttpServletRequest("POST", "/api/v1/appointments/hold");
        forged.setRemoteAddr("10.0.0.9");
        forged.addHeader(BffRequestVerifier.CLIENT_IP_HEADER, "203.0.113.99");
        limiter.check("confirm", forged, null);

        assertThat(redis.ipKeys("confirm").getFirst())
            .isEqualTo("healthcare:rate-limit:booking:confirm:ip:" + digest16("10.0.0.9"));
    }

    @Test
    void distinctTrustedClientsBehindOneProxyGetIndependentBuckets() {
        RecordingRedis redis = new RecordingRedis();
        BookingRateLimiter limiter = limiter(redis.template(), false);
        MockHttpServletRequest firstPatient = trustedRequest("10.0.0.2", "203.0.113.20");
        MockHttpServletRequest secondPatient = trustedRequest("10.0.0.2", "203.0.113.21");

        // One patient exhausts the 100-per-10-minute booking bucket...
        for (int index = 0; index < 100; index++) {
            limiter.check("confirm", firstPatient, null);
        }
        // ...yet a different patient behind the same proxy keeps a fresh bucket.
        assertThatCode(() -> limiter.check("confirm", secondPatient, null))
            .doesNotThrowAnyException();
        assertThatThrownBy(() -> limiter.check("confirm", firstPatient, null))
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
            );
    }

    @SuppressWarnings("unchecked")
    private static ConcurrentMap<String, Object> fallbackMap() throws Exception {
        Field field = BookingRateLimiter.class.getDeclaredField("FALLBACK");
        field.setAccessible(true);
        return (ConcurrentMap<String, Object>) field.get(null);
    }

    private static Object newWindow(Instant startedAt, long count) throws Exception {
        Class<?> windowClass = Class.forName("com.healthcare.appointment.security.BookingRateLimiter$Window");
        Constructor<?> constructor = windowClass.getDeclaredConstructor(Instant.class, long.class);
        constructor.setAccessible(true);
        return constructor.newInstance(startedAt, count);
    }

    private BookingRateLimiter limiter(StringRedisTemplate redis, boolean redisRequired) {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.bff.service-token", BFF_TOKEN);
        return new BookingRateLimiter(redis, new BffRequestVerifier(environment), true, redisRequired);
    }

    private MockHttpServletRequest trustedRequest(String remoteAddress, String clientIp) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/appointments/hold");
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

        RecordingRedis() {
            when(template.opsForValue()).thenReturn(values);
            when(values.increment(any(String.class))).thenAnswer(invocation -> {
                String key = invocation.getArgument(0);
                calls.add(key);
                return counters.merge(key, 1L, Long::sum);
            });
            when(template.getExpire(any(String.class))).thenReturn(60L);
        }

        List<String> ipKeys(String operation) {
            String prefix = "healthcare:rate-limit:booking:" + operation + ":ip:";
            return calls.stream().filter(key -> key.startsWith(prefix)).toList();
        }

        StringRedisTemplate template() {
            return template;
        }
    }
}
