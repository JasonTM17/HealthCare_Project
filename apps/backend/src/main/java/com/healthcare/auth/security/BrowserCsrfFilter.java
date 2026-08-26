package com.healthcare.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.exception.ApiError;
import com.healthcare.exception.ErrorCodes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;

@Component
public class BrowserCsrfFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final BrowserSessionService browserSessionService;
    private final BffRequestVerifier bffRequestVerifier;
    private final ObjectMapper objectMapper;

    public BrowserCsrfFilter(
            BrowserSessionService browserSessionService,
            BffRequestVerifier bffRequestVerifier,
            ObjectMapper objectMapper) {
        this.browserSessionService = browserSessionService;
        this.bffRequestVerifier = bffRequestVerifier;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        boolean credentialPresented = bffRequestVerifier.hasPresentedCredential(request);
        boolean trustedBff = bffRequestVerifier.isTrusted(request);
        if (credentialPresented && !trustedBff) {
            reject(request, response, "BFF request authentication failed");
            return;
        }

        if (trustedBff && BffRequestVerifier.isLegacyBearerMintRoute(
                request.getMethod(), request.getRequestURI())) {
            reject(request, response, "Browser clients must use the secure session endpoint");
            return;
        }

        if (SAFE_METHODS.contains(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Bearer clients remain stateless and are not subject to cookie CSRF.
        if (StringUtils.hasText(request.getHeader("Authorization"))) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean sessionCreation = "POST".equals(request.getMethod())
            && "/api/v1/auth/browser-sessions".equals(request.getRequestURI());
        boolean hasBrowserCookie = StringUtils.hasText(browserSessionService.cookieValue(
            request,
            BrowserSessionService.SESSION_COOKIE_NAME
        ));
        if (!sessionCreation && !hasBrowserCookie && !trustedBff) {
            // Preserve direct non-browser public API clients. Every mutation
            // that traverses the BFF is still protected because trustedBff is true.
            filterChain.doFilter(request, response);
            return;
        }

        if (!bffRequestVerifier.hasAllowedOrigin(request, trustedBff)) {
            reject(request, response, "Request origin is not allowed");
            return;
        }

        // The trusted same-origin BFF is the pre-session CSRF boundary for a
        // first login. Once a session cookie exists, its stored CSRF secret is
        // mandatory so account switching cannot reuse an ambient session.
        if (trustedBff && !hasBrowserCookie) {
            filterChain.doFilter(request, response);
            return;
        }

        String csrfCookie = browserSessionService.cookieValue(
            request,
            BrowserSessionService.CSRF_COOKIE_NAME
        );
        String csrfHeader = request.getHeader(BrowserSessionService.CSRF_HEADER_NAME);
        if (!sameNonBlankValue(csrfCookie, csrfHeader)) {
            reject(request, response, "CSRF validation failed");
            return;
        }

        BrowserSessionContext context = browserSessionService.context(request).orElse(null);
        if (context != null && !browserSessionService.csrfMatches(context, csrfHeader)) {
            reject(request, response, "CSRF validation failed");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean sameNonBlankValue(String first, String second) {
        if (!StringUtils.hasText(first) || !StringUtils.hasText(second)
                || first.length() > 128 || second.length() > 128) {
            return false;
        }
        return MessageDigest.isEqual(
            first.getBytes(StandardCharsets.UTF_8),
            second.getBytes(StandardCharsets.UTF_8)
        );
    }

    private void reject(
            HttpServletRequest request,
            HttpServletResponse response,
            String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiError error = new ApiError(
            403,
            "Forbidden",
            message,
            request.getRequestURI(),
            List.of(),
            ErrorCodes.ACCESS_DENIED
        );
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
}
