package com.healthcare.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class BffRequiredFilterTest {

    private static final String TOKEN = "test-only-bff-token-must-be-32-chars!!";

    @Test
    void disabledFilterDoesNotRequireBffHeader() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        MockHttpServletResponse response = invoke(
            filter(false, TOKEN),
            "GET",
            "/api/v1/hospital/specialties",
            null,
            accepted
        );
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void requiredFilterRejectsBearerOnlyHospitalRead() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        MockHttpServletResponse response = invoke(
            filter(true, TOKEN),
            "GET",
            "/api/v1/hospital/specialties",
            null,
            accepted
        );
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("Trusted BFF credential is required");
        assertThat(accepted).hasValue(0);
    }

    @Test
    void requiredFilterAcceptsTrustedBff() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        MockHttpServletResponse response = invoke(
            filter(true, TOKEN),
            "GET",
            "/api/v1/hospital/specialties",
            TOKEN,
            accepted
        );
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(accepted).hasValue(1);
    }

    @Test
    void requiredFilterKeepsHealthAndPaymentWebhookOpen() throws Exception {
        BffRequiredFilter filter = filter(true, TOKEN);
        AtomicInteger accepted = new AtomicInteger();
        assertThat(invoke(filter, "GET", "/api/v1/health", null, accepted).getStatus()).isEqualTo(200);
        assertThat(invoke(filter, "POST", "/api/v1/payments/webhooks/bank-transfer", null, accepted).getStatus())
            .isEqualTo(200);
        assertThat(accepted).hasValue(2);
    }

    private BffRequiredFilter filter(boolean required, String token) {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("app.security.bff.required", Boolean.toString(required))
            .withProperty("app.security.bff.service-token", token);
        return new BffRequiredFilter(
            new BffRequestVerifier(environment),
            new ObjectMapper().findAndRegisterModules(),
            environment
        );
    }

    private MockHttpServletResponse invoke(
            BffRequiredFilter filter,
            String method,
            String path,
            String bffToken,
            AtomicInteger accepted) throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        if (bffToken != null) {
            request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, bffToken);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> accepted.incrementAndGet());
        return response;
    }
}
