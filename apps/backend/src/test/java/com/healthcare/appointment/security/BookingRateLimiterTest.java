package com.healthcare.appointment.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BookingRateLimiterTest {

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
}
