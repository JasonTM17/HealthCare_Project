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
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Applies bounded IP and normalized-email limits to auth flows. Redis shares
 * counters across local replicas; the bounded fallback remains fail-closed
 * enough for a Redis outage without retaining raw identifiers.
 *
 * <p>The IP bucket keys on the canonical client literal the BFF reports
 * ({@link BffRequestVerifier#trustedClientIpLiteral}), exactly like
 * {@code RequestRateLimitFilter}, so every visitor behind a single deployment
 * proxy does not collapse into one shared bucket. Only an authenticated BFF
 * can supply that header; a forged value falls back to the socket address.
 *
 * <p>When {@code app.security.rate-limit.redis-required=true} (hosted beta),
 * a Redis outage fails closed with a 503 instead of silently multiplying the
 * per-replica limits; the shared counter key is never deleted, because a
 * transient client-side failure must not reset every replica's window.
 */
@Component
public class AuthRateLimiter {

    private static final int MAX_FALLBACK_ENTRIES = 20_000;
    private static final Object FALLBACK_LOCK = new Object();
    private static final Map<String, Window> FALLBACK = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final BffRequestVerifier bffRequestVerifier;
    private final boolean enabled;
    private final boolean redisRequired;
    private final Duration window;
    private final int ipLimit;
    private final int emailLimit;

    @Autowired
    public AuthRateLimiter(StringRedisTemplate redisTemplate, Environment environment,
                           BffRequestVerifier bffRequestVerifier) {
        this(
            redisTemplate,
            bffRequestVerifier,
            environment.getProperty("app.security.rate-limit.enabled", Boolean.class, true)
                && environment.getProperty("app.security.auth-otp.enabled", Boolean.class, true),
            Duration.ofSeconds(environment.getProperty("app.security.auth-otp.window-seconds", Long.class, 900L)),
            environment.getProperty("app.security.auth-otp.ip-limit", Integer.class, 20),
            environment.getProperty("app.security.auth-otp.email-limit", Integer.class, 5),
            environment.getProperty("app.security.rate-limit.redis-required", Boolean.class, false)
        );
    }

    AuthRateLimiter(StringRedisTemplate redisTemplate, BffRequestVerifier bffRequestVerifier,
                    boolean enabled, Duration window, int ipLimit, int emailLimit,
                    boolean redisRequired) {
        this.redisTemplate = redisTemplate;
        this.bffRequestVerifier = bffRequestVerifier;
        this.enabled = enabled;
        this.redisRequired = redisRequired;
        this.window = window;
        this.ipLimit = ipLimit;
        this.emailLimit = emailLimit;
    }

    public void check(HttpServletRequest request, String email, String operation) {
        if (!enabled) {
            return;
        }
        enforce(operation + ":ip", clientKey(request), ipLimit);
        if (email != null && !email.isBlank()) {
            enforce(operation + ":email", email.trim().toLowerCase(), emailLimit);
        }
    }

    public void checkEmail(String email, String operation) {
        if (enabled && email != null && !email.isBlank()) {
            enforce(operation + ":email", email.trim().toLowerCase(), emailLimit);
        }
    }

    private String clientKey(HttpServletRequest request) {
        if (request == null) {
            return "unknown-client";
        }
        return bffRequestVerifier.trustedClientIpLiteral(request)
            .or(() -> Optional.ofNullable(request.getRemoteAddr()))
            .orElse("unknown-client");
    }

    private void enforce(String operation, String value, int limit) {
        String key = "healthcare:rate-limit:auth:" + operation + ":" + digest(value);
        Long count;
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
            // Mirrors RequestRateLimitFilter: deployments that set
            // app.security.rate-limit.redis-required=true fail closed — a
            // Redis outage must not silently multiply per-replica auth limits.
            if (redisRequired) {
                throw new BusinessException(
                    503,
                    ErrorCodes.SERVICE_UNAVAILABLE,
                    "Dịch vụ xác thực yêu cầu đang tạm gián đoạn. Vui lòng thử lại sau ít phút."
                );
            }
            // The shared counter is deliberately not deleted here: a transient
            // Redis failure must not reset every replica's window and hand the
            // attacker a fresh budget. The bounded local fallback continues.
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
