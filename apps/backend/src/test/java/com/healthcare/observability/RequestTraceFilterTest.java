package com.healthcare.observability;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestTraceFilterTest {

    private final RequestTraceFilter filter = new RequestTraceFilter();

    @Test
    void preservesCanonicalRequestIdForTheRequestAndResponse() throws Exception {
        String expected = "123e4567-e89b-42d3-a456-426614174000";
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/ai/chat");
        request.addHeader(RequestTrace.HEADER, expected.toUpperCase());
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> observed = new AtomicReference<>();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
            observed.set(RequestTrace.currentId()));

        assertThat(observed.get()).isEqualTo(expected);
        assertThat(request.getAttribute(RequestTrace.REQUEST_ATTRIBUTE)).isEqualTo(expected);
        assertThat(response.getHeader(RequestTrace.HEADER)).isEqualTo(expected);
        assertThat(RequestTrace.currentId()).isNull();
    }

    @Test
    void replacesUntrustedRequestIdWithABoundedUuid() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/ai/chat");
        request.addHeader(RequestTrace.HEADER, "forged\r\nlog-entry");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestTrace.HEADER))
            .matches("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
        assertThat(response.getHeader(RequestTrace.HEADER)).isNotEqualTo("forged\r\nlog-entry");
        assertThat(RequestTrace.currentId()).isNull();
    }
}
