package com.healthcare.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.exception.ApiError;
import com.healthcare.exception.ErrorCodes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * When {@code app.security.bff.required=true}, browser and API traffic must
 * present a trusted BFF credential. Health, actuator, and the HMAC payment
 * webhook remain reachable without that header.
 */
@Component
public class BffRequiredFilter extends OncePerRequestFilter {

    private static final Set<String> OPEN_PATHS = Set.of(
        "/api/v1/health",
        "/actuator/health",
        "/actuator/info",
        "/error"
    );

    private final BffRequestVerifier bffRequestVerifier;
    private final ObjectMapper objectMapper;
    private final boolean required;

    public BffRequiredFilter(
            BffRequestVerifier bffRequestVerifier,
            ObjectMapper objectMapper,
            Environment environment) {
        this.bffRequestVerifier = bffRequestVerifier;
        this.objectMapper = objectMapper;
        this.required = Boolean.TRUE.equals(
            environment.getProperty("app.security.bff.required", Boolean.class, false)
        );
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!required || isOpen(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        if (bffRequestVerifier.isTrusted(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiError error = new ApiError(
            HttpStatus.UNAUTHORIZED.value(),
            HttpStatus.UNAUTHORIZED.getReasonPhrase(),
            "Trusted BFF credential is required",
            request.getRequestURI(),
            java.util.List.of(),
            ErrorCodes.AUTHENTICATION_REQUIRED
        );
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }

    private boolean isOpen(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }
        if (OPEN_PATHS.contains(path) || path.startsWith("/actuator/health")) {
            return true;
        }
        return "POST".equalsIgnoreCase(request.getMethod())
            && "/api/v1/payments/webhooks/bank-transfer".equals(path);
    }
}
