package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.auth.security.BffRequestVerifier;
import com.healthcare.exception.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bounded, per-process fixed-window limiter for abuse-sensitive endpoints.
 * Redis shares the counter across application replicas. The bounded local
 * fallback is retained only for development/test runtimes; hosted beta sets
 * the Redis-required flag so an outage fails closed instead of bypassing the
 * global limit on each instance.
 */
@Component
public class RequestRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_KEYS = 50_000;
    private final ObjectMapper objectMapper;
    private final BffRequestVerifier bffRequestVerifier;
    private final StringRedisTemplate redisTemplate;
    private final boolean enabled;
    private final boolean redisRequired;
    private final long windowMillis;
    private final int authLimit;
    private final int appointmentLimit;
    private final int paymentLimit;
    private final int webhookLimit;
    private final int aiLimit;
    private final int publicTriageLimit;
    private final int careerApplicationLimit;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public RequestRateLimitFilter(
            ObjectMapper objectMapper,
            Environment environment,
            BffRequestVerifier bffRequestVerifier,
            StringRedisTemplate redisTemplate) {
        this(objectMapper, environment, bffRequestVerifier, redisTemplate, true);
    }

    public RequestRateLimitFilter(
            ObjectMapper objectMapper,
            Environment environment,
            BffRequestVerifier bffRequestVerifier) {
        this(objectMapper, environment, bffRequestVerifier, null, true);
    }

    RequestRateLimitFilter(
            ObjectMapper objectMapper,
            Environment environment,
            BffRequestVerifier bffRequestVerifier,
            StringRedisTemplate redisTemplate,
            boolean allowRedis) {
        this.objectMapper = objectMapper;
        this.bffRequestVerifier = bffRequestVerifier;
        this.redisTemplate = allowRedis ? redisTemplate : null;
        this.enabled = environment.getProperty("app.security.rate-limit.enabled", Boolean.class, true);
        this.redisRequired = environment.getProperty(
            "app.security.rate-limit.redis-required", Boolean.class, false
        );
        this.windowMillis = environment.getProperty("app.security.rate-limit.window-seconds", Long.class, 60L) * 1_000L;
        this.authLimit = environment.getProperty("app.security.rate-limit.auth-limit", Integer.class, 20);
        this.appointmentLimit = environment.getProperty("app.security.rate-limit.appointment-limit", Integer.class, 60);
        this.paymentLimit = environment.getProperty("app.security.rate-limit.payment-limit", Integer.class, 20);
        this.webhookLimit = environment.getProperty("app.security.rate-limit.webhook-limit", Integer.class, 120);
        this.aiLimit = environment.getProperty("app.security.rate-limit.ai-limit", Integer.class, 30);
        this.publicTriageLimit = environment.getProperty(
            "app.security.rate-limit.public-triage-limit", Integer.class, 20
        );
        this.careerApplicationLimit = environment.getProperty(
            "app.security.rate-limit.career-application-limit", Integer.class, 10
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        LimitRule rule = enabled ? ruleFor(request) : null;
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long now = System.currentTimeMillis();
        String clientAddress = bffRequestVerifier.trustedClientIpLiteral(request)
            .orElseGet(request::getRemoteAddr);
        String key = clientAddress + ':' + rule.category();
        RateDecision decision = redisTemplate == null
            ? redisRequired
                ? new RateDecision(0L, 5L, true)
                : localDecision(key, now)
            : redisDecision(key, now);
        if (decision.unavailable()) {
            rejectUnavailable(response);
            return;
        }
        if (decision.count() > rule.limit()) {
            long retryAfter = Math.max(1, decision.retryAfterSeconds());
            reject(request, response, retryAfter);
            return;
        }
        if (counters.size() > 10_000) {
            counters.entrySet().removeIf(entry -> now >= entry.getValue().windowStartedAt + windowMillis);
        }
        filterChain.doFilter(request, response);
    }

    private RateDecision redisDecision(String key, long now) {
        try {
            String redisKey = "healthcare:rate-limit:request:" + digest(key);
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count == null) throw new IllegalStateException("Redis did not return a rate-limit count");
            Long ttl = redisTemplate.getExpire(redisKey);
            if (ttl == null || ttl < 0L) {
                Boolean expirySet = redisTemplate.expire(redisKey, Duration.ofMillis(windowMillis));
                if (!Boolean.TRUE.equals(expirySet)) {
                    throw new IllegalStateException("Redis did not set a rate-limit expiry");
                }
                ttl = windowMillis / 1_000L;
            }
            return new RateDecision(count, Math.max(1L, ttl), false);
        } catch (RuntimeException exception) {
            try {
                redisTemplate.delete("healthcare:rate-limit:request:" + digest(key));
            } catch (RuntimeException ignoredCleanup) {
                // The hosted-required path remains fail-closed; development
                // can still use its bounded local fallback.
            }
            if (redisRequired) return new RateDecision(0L, 5L, true);
            return localDecision(key, now);
        }
    }

    private RateDecision localDecision(String key, long now) {
        if (counters.size() >= MAX_TRACKED_KEYS && !counters.containsKey(key)) {
            return new RateDecision(MAX_TRACKED_KEYS + 1L, windowMillis / 1_000L, false);
        }
        WindowCounter counter = counters.compute(key, (ignored, current) ->
            current == null || now >= current.windowStartedAt + windowMillis
                ? new WindowCounter(now)
                : current.incremented()
        );
        return new RateDecision(
            counter.count.get(),
            Math.max(1L, (counter.windowStartedAt + windowMillis - now + 999) / 1_000L),
            false
        );
    }

    private LimitRule ruleFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if ("POST".equals(method) && (path.equals("/api/v1/auth/login")
                || path.equals("/api/v1/auth/browser-sessions")
                || path.equals("/api/v1/auth/register") || path.equals("/api/v1/auth/refresh")
                || path.equals("/api/v1/auth/email-verifications/confirm")
                || path.equals("/api/v1/auth/email-verifications/resend")
                || path.equals("/api/v1/auth/password-reset-requests")
                || path.equals("/api/v1/auth/password-reset-requests/confirm")
                || path.equals("/api/v1/auth/verify-email")
                || path.equals("/api/v1/auth/confirm-email")
                || path.equals("/api/v1/auth/resend-verification")
                || path.equals("/api/v1/auth/resend-email-verification")
                || path.equals("/api/v1/auth/forgot-password")
                || path.equals("/api/v1/auth/password-reset/request")
                || path.equals("/api/v1/auth/password-reset/confirm")
                || path.equals("/api/v1/auth/reset-password/request")
                || path.equals("/api/v1/auth/reset-password/confirm"))) {
            return new LimitRule("auth", authLimit);
        }
        if ("POST".equals(method) && path.startsWith("/api/v1/appointments/")) {
            return new LimitRule("appointments", appointmentLimit);
        }
        if ("POST".equals(method) && path.equals("/api/v1/payments/webhooks/bank-transfer")) {
            return new LimitRule("payment-webhook", webhookLimit);
        }
        if (("POST".equals(method) && path.matches("^/api/v1/patient/appointments/[^/]+/payment/submit$"))
                || ("PATCH".equals(method) && path.matches("^/api/v1/admin/payments/[^/]+(?:/refund)?$"))) {
            return new LimitRule("payments", paymentLimit);
        }
        if ("POST".equals(method) && path.matches("^/api/v1/careers/jobs/[^/]+/applications$")) {
            return new LimitRule("career-applications", careerApplicationLimit);
        }
        if ("POST".equals(method) && path.equals("/api/v1/public/specialty-recommendation")) {
            return new LimitRule("public-triage", publicTriageLimit);
        }
        if (path.startsWith("/api/v1/ai/") || path.equals("/api/v1/public/ai/chat")) {
            return new LimitRule("ai", aiLimit);
        }
        return null;
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, long retryAfter) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", Long.toString(retryAfter));
        objectMapper.writeValue(response.getWriter(), new ApiError(
            HttpStatus.TOO_MANY_REQUESTS.value(), HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
            "Too many requests. Please retry later.", request.getRequestURI()
        ));
    }

    private void rejectUnavailable(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", "5");
        objectMapper.writeValue(response.getWriter(), Map.of("code", "RATE_LIMIT_BACKEND_UNAVAILABLE"));
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

    private record LimitRule(String category, int limit) {}

    private record RateDecision(long count, long retryAfterSeconds, boolean unavailable) {}

    private static final class WindowCounter {
        private final long windowStartedAt;
        private final AtomicInteger count;

        private WindowCounter(long windowStartedAt) {
            this.windowStartedAt = windowStartedAt;
            this.count = new AtomicInteger(1);
        }

        private WindowCounter incremented() {
            count.incrementAndGet();
            return this;
        }
    }
}
