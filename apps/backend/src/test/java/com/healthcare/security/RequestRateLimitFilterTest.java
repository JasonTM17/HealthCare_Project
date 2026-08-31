package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.auth.security.BffRequestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.RedisConnectionFailureException;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RequestRateLimitFilterTest {

    private static final String TEST_BFF_TOKEN = "0123456789abcdef0123456789abcdef";

    @Test
    void rejectsAuthRequestsOverConfiguredLimitWithRetryAfter() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.auth-limit", "2")
            .withProperty("app.security.rate-limit.window-seconds", "60");
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        for (int attempt = 1; attempt <= 3; attempt++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setRemoteAddr("127.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
            if (attempt == 3) {
                assertThat(response.getStatus()).isEqualTo(429);
                assertThat(response.getHeader("Retry-After")).isNotBlank();
                assertThat(response.getContentAsString()).contains("Too many requests");
            }
        }
        assertThat(accepted).hasValue(2);
    }

    @Test
    void sharedRedisCounterLimitsAcrossFilterInstances() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(any(String.class))).thenReturn(1L, 2L);
        when(redis.getExpire(any(String.class))).thenReturn(60L);
        RequestRateLimitFilter first = filter(environment, redis);
        RequestRateLimitFilter second = filter(environment, redis);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse firstResponse = invokeAuth(
            first, accepted, "10.0.0.12", null, null, null, null
        );
        MockHttpServletResponse secondResponse = invokeAuth(
            second, accepted, "10.0.0.12", null, null, null, null
        );

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(secondResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void redisRequiredModeFailsClosedWhenDistributedCounterIsUnavailable() throws Exception {
        MockEnvironment environment = rateLimitEnvironment()
            .withProperty("app.security.rate-limit.redis-required", "true");
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(any(String.class)))
            .thenThrow(new RedisConnectionFailureException("synthetic outage"));
        RequestRateLimitFilter filter = filter(environment, redis);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse response = invokeAuth(
            filter, accepted, "10.0.0.13", null, null, null, null
        );

        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("RATE_LIMIT_BACKEND_UNAVAILABLE");
        assertThat(accepted).hasValue(0);
    }

    @Test
    void redisRequiredModeAlsoFailsClosedWhenNoRedisTemplateIsAvailable() throws Exception {
        MockEnvironment environment = rateLimitEnvironment()
            .withProperty("app.security.rate-limit.redis-required", "true");
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse response = invokeAuth(
            filter, accepted, "10.0.0.14", null, null, null, null
        );

        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(accepted).hasValue(0);
    }

    @Test
    void leavesOrdinaryPublicReadsUnthrottled() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.auth-limit", "1");
        RequestRateLimitFilter filter = filter(environment);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/hospital/doctors");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicInteger accepted = new AtomicInteger();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());

        assertThat(accepted).hasValue(1);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void limitsPublicCareerApplicationsWithoutThrottlingJobReads() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.career-application-limit", "1")
            .withProperty("app.security.rate-limit.window-seconds", "60");
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletRequest readRequest = new MockHttpServletRequest("GET", "/api/v1/careers/jobs");
        filter.doFilter(readRequest, new MockHttpServletResponse(),
            (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());

        for (int attempt = 1; attempt <= 2; attempt++) {
            MockHttpServletRequest request = new MockHttpServletRequest(
                "POST", "/api/v1/careers/jobs/dieu-duong-da-khoa/applications"
            );
            request.setRemoteAddr("127.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
            if (attempt == 2) assertThat(response.getStatus()).isEqualTo(429);
        }

        assertThat(accepted).hasValue(2);
    }

    @Test
    void rateLimitsStatelessPublicAiChat() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.ai-limit", "1")
            .withProperty("app.security.rate-limit.window-seconds", "60");
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse first = invokePost(
            filter, accepted, "/api/v1/public/ai/chat", "203.0.113.70"
        );
        MockHttpServletResponse repeated = invokePost(
            filter, accepted, "/api/v1/public/ai/chat", "203.0.113.70"
        );

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(repeated.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void trustedBffUsesCanonicalClientIpAsRateLimitKey() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse firstResponse = invokeAuth(
            filter, accepted, "10.0.0.5", TEST_BFF_TOKEN, "203.0.113.10", null, null
        );
        MockHttpServletResponse secondResponse = invokeAuth(
            filter, accepted, "10.0.0.5", TEST_BFF_TOKEN, "203.0.113.11", null, null
        );
        MockHttpServletResponse repeatedResponse = invokeAuth(
            filter, accepted, "10.0.0.5", TEST_BFF_TOKEN, "203.0.113.10", null, null
        );

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(secondResponse.getStatus()).isEqualTo(200);
        assertThat(repeatedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(2);
    }

    @Test
    void untrustedOrForgedBffClientIpFallsBackToRemoteAddress() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse untrustedResponse = invokeAuth(
            filter, accepted, "10.0.0.6", null, "203.0.113.20", null, null
        );
        MockHttpServletResponse forgedResponse = invokeAuth(
            filter, accepted, "10.0.0.6", "forged-bff-token", "203.0.113.21", null, null
        );

        assertThat(untrustedResponse.getStatus()).isEqualTo(200);
        assertThat(forgedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void malformedClientIpAndStandardProxyHeadersFallBackWithoutDnsLookup() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse malformedResponse = invokeAuth(
            filter, accepted, "10.0.0.7", TEST_BFF_TOKEN, "203.0.113.30, 10.0.0.1",
            "198.51.100.1", null
        );
        MockHttpServletResponse hostnameResponse = invokeAuth(
            filter, accepted, "10.0.0.7", TEST_BFF_TOKEN, "patient.example",
            null, "198.51.100.2"
        );

        assertThat(malformedResponse.getStatus()).isEqualTo(200);
        assertThat(hostnameResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void equivalentIpv6LiteralsShareOneCanonicalRateLimitKey() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse compressedResponse = invokeAuth(
            filter, accepted, "10.0.0.8", TEST_BFF_TOKEN, "2001:db8::1", null, null
        );
        MockHttpServletResponse expandedResponse = invokeAuth(
            filter, accepted, "10.0.0.8", TEST_BFF_TOKEN, "2001:0db8:0:0:0:0:0:1", null, null
        );

        assertThat(compressedResponse.getStatus()).isEqualTo(200);
        assertThat(expandedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void browserSessionGrantsUseTheAuthRateLimit() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse firstResponse = invokePost(
            filter, accepted, "/api/v1/auth/browser-sessions", "10.0.0.9"
        );
        MockHttpServletResponse repeatedResponse = invokePost(
            filter, accepted, "/api/v1/auth/browser-sessions", "10.0.0.9"
        );

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(repeatedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void duplicateClientIpHeadersAreRejectedAndFallBackToRemoteAddress() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse firstResponse = invokeWithDuplicateHeaders(
            filter, accepted, "10.0.0.10",
            new String[] { TEST_BFF_TOKEN },
            new String[] { "203.0.113.40", "203.0.113.41" }
        );
        MockHttpServletResponse repeatedResponse = invokeWithDuplicateHeaders(
            filter, accepted, "10.0.0.10",
            new String[] { TEST_BFF_TOKEN },
            new String[] { "203.0.113.42", "203.0.113.43" }
        );

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(repeatedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void duplicateBffCredentialsAreRejectedAndClientIpFallsBack() throws Exception {
        MockEnvironment environment = rateLimitEnvironment();
        RequestRateLimitFilter filter = filter(environment);
        AtomicInteger accepted = new AtomicInteger();

        MockHttpServletResponse firstResponse = invokeWithDuplicateHeaders(
            filter, accepted, "10.0.0.11",
            new String[] { TEST_BFF_TOKEN, "forged-bff-token" },
            new String[] { "203.0.113.50" }
        );
        MockHttpServletResponse repeatedResponse = invokeWithDuplicateHeaders(
            filter, accepted, "10.0.0.11",
            new String[] { TEST_BFF_TOKEN, "forged-bff-token" },
            new String[] { "203.0.113.51" }
        );

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(repeatedResponse.getStatus()).isEqualTo(429);
        assertThat(accepted).hasValue(1);
    }

    private MockEnvironment rateLimitEnvironment() {
        return new MockEnvironment()
            .withProperty("app.security.rate-limit.auth-limit", "1")
            .withProperty("app.security.rate-limit.window-seconds", "60")
            .withProperty("app.security.bff.service-token", TEST_BFF_TOKEN);
    }

    @Test
    void rejectsWeakOrMissingRequiredBffCredentialAtConstruction() {
        assertThatThrownBy(() -> new BffRequestVerifier(new MockEnvironment()
                .withProperty("app.security.bff.service-token", "too-short")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("BFF service credential must be at least 32 bytes");

        assertThatThrownBy(() -> new BffRequestVerifier(new MockEnvironment()
                .withProperty("app.security.bff.required", "true")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("BFF service credential is required");

        assertThat(new BffRequestVerifier(new MockEnvironment())).isNotNull();
    }

    private RequestRateLimitFilter filter(MockEnvironment environment) {
        return new RequestRateLimitFilter(
            new ObjectMapper().findAndRegisterModules(),
            environment,
            new BffRequestVerifier(environment)
        );
    }

    private RequestRateLimitFilter filter(MockEnvironment environment, StringRedisTemplate redisTemplate) {
        return new RequestRateLimitFilter(
            new ObjectMapper().findAndRegisterModules(),
            environment,
            new BffRequestVerifier(environment),
            redisTemplate
        );
    }

    private MockHttpServletResponse invokeAuth(
            RequestRateLimitFilter filter,
            AtomicInteger accepted,
            String remoteAddress,
            String bffCredential,
            String clientIp,
            String forwardedFor,
            String realIp) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddress);
        if (bffCredential != null) request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, bffCredential);
        if (clientIp != null) request.addHeader(BffRequestVerifier.CLIENT_IP_HEADER, clientIp);
        if (forwardedFor != null) request.addHeader("X-Forwarded-For", forwardedFor);
        if (realIp != null) request.addHeader("X-Real-IP", realIp);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
        return response;
    }

    private MockHttpServletResponse invokePost(
            RequestRateLimitFilter filter,
            AtomicInteger accepted,
            String path,
            String remoteAddress) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(remoteAddress);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
        return response;
    }

    private MockHttpServletResponse invokeWithDuplicateHeaders(
            RequestRateLimitFilter filter,
            AtomicInteger accepted,
            String remoteAddress,
            String[] bffCredentials,
            String[] clientIps) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddress);
        for (String credential : bffCredentials) {
            request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, credential);
        }
        for (String clientIp : clientIps) {
            request.addHeader(BffRequestVerifier.CLIENT_IP_HEADER, clientIp);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
        return response;
    }
}
