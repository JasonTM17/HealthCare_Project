package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class RequestRateLimitFilterTest {

    @Test
    void rejectsAuthRequestsOverConfiguredLimitWithRetryAfter() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.auth-limit", "2")
            .withProperty("app.security.rate-limit.window-seconds", "60");
        RequestRateLimitFilter filter = new RequestRateLimitFilter(new ObjectMapper().findAndRegisterModules(), environment);
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
    void leavesOrdinaryPublicReadsUnthrottled() throws Exception {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.rate-limit.auth-limit", "1");
        RequestRateLimitFilter filter = new RequestRateLimitFilter(new ObjectMapper().findAndRegisterModules(), environment);
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
        RequestRateLimitFilter filter = new RequestRateLimitFilter(new ObjectMapper().findAndRegisterModules(), environment);
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
}
