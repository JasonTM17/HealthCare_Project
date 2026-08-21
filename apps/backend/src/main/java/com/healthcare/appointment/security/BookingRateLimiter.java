package com.healthcare.appointment.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limits unauthenticated booking operations by both client address and the
 * supplied booking subject. Redis makes the limit useful across Compose
 * replicas; the bounded in-memory fallback keeps integration tests explicit
 * when no Redis server is available.
 */
@Component
public class BookingRateLimiter {

    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final Map<String, Window> FALLBACK = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final boolean enabled;

    @Autowired
    public BookingRateLimiter(StringRedisTemplate redisTemplate, Environment environment) {
        this(redisTemplate, environment.getProperty("app.security.rate-limit.enabled", Boolean.class, true));
    }

    public BookingRateLimiter(StringRedisTemplate redisTemplate) {
        this(redisTemplate, true);
    }

    BookingRateLimiter(StringRedisTemplate redisTemplate, boolean enabled) {
        this.redisTemplate = redisTemplate;
        this.enabled = enabled;
    }

    public void check(String operation, HttpServletRequest request, String subject) {
        if (!enabled) {
            return;
        }
        String client = request != null && request.getRemoteAddr() != null
            ? request.getRemoteAddr()
            : "unknown-client";
        enforce(operation + ":ip", client, 100);
        if (subject != null && !subject.isBlank()) {
            enforce(operation + ":subject", subject.trim().toLowerCase(), 10);
        }
    }

    private void enforce(String operation, String value, int limit) {
        String key = "healthcare:rate-limit:booking:" + operation + ":" + digest(value);
        Long count = null;
        try {
            count = redisTemplate.opsForValue().increment(key);
            if (count == null) {
                throw new IllegalStateException("Redis did not return a rate-limit count");
            }
            Long ttl = redisTemplate.getExpire(key);
            if (ttl == null || ttl < 0L) {
                Boolean expirySet = redisTemplate.expire(key, WINDOW);
                if (!Boolean.TRUE.equals(expirySet)) {
                    throw new IllegalStateException("Redis did not set a rate-limit expiry");
                }
            }
        } catch (RuntimeException ignored) {
            // A Redis outage must not make the public booking endpoint fail
            // open. The local fallback is deliberately smaller and bounded.
            try {
                // Do not leave a counter without a TTL: a later Redis recovery
                // must not turn one transient expiry failure into a permanent
                // throttle. If deletion also fails, the next Redis call will
                // repair the missing TTL before evaluating the count.
                redisTemplate.delete(key);
            } catch (RuntimeException ignoredCleanup) {
                // Fall through to the bounded local fallback.
            }
            count = null;
        }

        if (count == null) {
            count = fallbackCount(key);
        }
        if (count > limit) {
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút."
            );
        }
    }

    private long fallbackCount(String key) {
        Instant now = Instant.now();
        Window window = FALLBACK.compute(key, (ignored, previous) -> {
            if (previous == null || now.isAfter(previous.startedAt.plus(WINDOW))) {
                return new Window(now, 1L);
            }
            return new Window(previous.startedAt, previous.count + 1L);
        });
        if (FALLBACK.size() > 10_000) {
            FALLBACK.entrySet().removeIf(entry -> now.isAfter(entry.getValue().startedAt.plus(WINDOW)));
        }
        return window.count;
    }

    private String digest(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to create a rate-limit key", exception);
        }
    }

    private record Window(Instant startedAt, long count) { }
}
