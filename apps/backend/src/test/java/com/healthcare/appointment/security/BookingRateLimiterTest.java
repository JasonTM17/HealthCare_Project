package com.healthcare.appointment.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.Duration;
import java.util.concurrent.ConcurrentMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BookingRateLimiterTest {

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
}
