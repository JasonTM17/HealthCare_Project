package com.healthcare.auth.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class BffRequestVerifierTest {

    private static final String TOKEN = "test-only-bff-token-must-be-32-chars!!";

    @Test
    void defaultTrustedBffOriginsAcceptBothLocalLoopbackNames() {
        BffRequestVerifier verifier = new BffRequestVerifier(
            new MockEnvironment().withProperty("app.security.bff.service-token", TOKEN)
        );

        MockHttpServletRequest localhost = trustedRequest("http://localhost:3000");
        MockHttpServletRequest loopback = trustedRequest("http://127.0.0.1:3000");

        assertThat(verifier.hasAllowedOrigin(localhost, true)).isTrue();
        assertThat(verifier.hasAllowedOrigin(loopback, true)).isTrue();
    }

    private MockHttpServletRequest trustedRequest(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/ai/chat");
        request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, TOKEN);
        request.addHeader(BffRequestVerifier.ORIGINAL_ORIGIN_HEADER, origin);
        return request;
    }
}
