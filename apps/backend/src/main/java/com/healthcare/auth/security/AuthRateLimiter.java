package com.healthcare.auth.security;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Applies bounded IP and normalized-email limits to auth flows. Redis shares
 * counters across local replicas; the bounded fallback remains fail-closed
 * enough for a Redis outage without retaining raw identifiers.
 */
@Component
public class AuthRateLimiter {

    private static final int MAX_FALLBACK_ENTRIES = 20_000;
    private static final Object FALLBACK_LOCK = new Object();
    private static final Map<String, Window> FALLBACK = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final boolean enabled;
    private final Duration window;
    private final int ipLimit;
    private final int emailLimit;

    @Autowired
    public AuthRateLimiter(StringRedisTemplate redisTemplate, Environment environment) {
        this(
            redisTemplate,
            environment.getProperty("app.security.rate-limit.enabled", Boolean.class, true)
                && environment.getProperty("app.security.auth-otp.enabled", Boolean.class, true),
            Duration.ofSeconds(environment.getProperty("app.security.auth-otp.window-seconds", Long.class, 900L)),
            environment.getProperty("app.security.auth-otp.ip-limit", Integer.class, 20),
            environment.getProperty("app.security.auth-otp.email-limit", Integer.class, 5)
        );
    }

    public AuthRateLimiter(StringRedisTemplate redisTemplate, boolean enabled) {
        this(redisTemplate, enabled, Duration.ofMinutes(15), 20, 5);
    }

    AuthRateLimiter(StringRedisTemplate redisTemplate, boolean enabled, Duration window,
                    int ipLimit, int emailLimit) {
        this.redisTemplate = redisTemplate;
        this.enabled = enabled;
        this.window = window;
        this.ipLimit = ipLimit;
        this.emailLimit = emailLimit;
    }

    public void check(HttpServletRequest request, String email, String operation) {
        if (!enabled) {
            return;
        }
        String client = request == null || request.getRemoteAddr() == null
            ? "unknown-client"
            : request.getRemoteAddr();
        enforce(operation + ":ip", client, ipLimit);
        if (email != null && !email.isBlank()) {
            enforce(operation + ":email", email.trim().toLowerCase(), emailLimit);
        }
    }

    public void checkEmail(String email, String operation) {
        if (enabled && email != null && !email.isBlank()) {
            enforce(operation + ":email", email.trim().toLowerCase(), emailLimit);
        }
    }

    private void enforce(String operation, String value, int limit) {
        String key = "healthcare:rate-limit:auth:" + operation + ":" + digest(value);
        Long count = null;
        try {
            count = redisTemplate.opsForValue().increment(key);
            if (count == null) {
                throw new IllegalStateException("Redis did not return a rate-limit count");
            }
            Long ttl = redisTemplate.getExpire(key);
            if (ttl == null || ttl < 0L) {
                Boolean expirySet = redisTemplate.expire(key, window);
                if (!Boolean.TRUE.equals(expirySet)) {
                    throw new IllegalStateException("Redis did not set a rate-limit expiry");
                }
            }
        } catch (RuntimeException ignored) {
            try {
                redisTemplate.delete(key);
            } catch (RuntimeException ignoredCleanup) {
                // Continue with the bounded local counter.
            }
            count = null;
        }

        if (count == null) {
            count = fallbackCount(key);
        }
        if (count > limit) {
            throw new BusinessException(
                429,
                ErrorCodes.RATE_LIMIT_EXCEEDED,
                "Too many requests. Please retry later."
            );
        }
    }

    private long fallbackCount(String key) {
        Instant now = Instant.now();
        synchronized (FALLBACK_LOCK) {
            FALLBACK.entrySet().removeIf(entry -> now.isAfter(entry.getValue().startedAt.plus(window)));
            Window previous = FALLBACK.get(key);
            if (previous != null && !now.isAfter(previous.startedAt.plus(window))) {
                Window updated = new Window(previous.startedAt, previous.count + 1L);
                FALLBACK.put(key, updated);
                return updated.count;
            }
            if (FALLBACK.size() >= MAX_FALLBACK_ENTRIES) {
                throw new BusinessException(
                    429,
                    ErrorCodes.RATE_LIMIT_EXCEEDED,
                    "Too many requests. Please retry later."
                );
            }
            FALLBACK.put(key, new Window(now, 1L));
            return 1L;
        }
    }

    private String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes, 0, 16);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to create a rate-limit key", exception);
        }
    }

    private record Window(Instant startedAt, long count) {
    }
}
