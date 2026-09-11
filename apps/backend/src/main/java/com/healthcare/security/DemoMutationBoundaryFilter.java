package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.exception.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Central server-side demo trust boundary (HC-01, D-01).
 *
 * <p>UI hiding is never the enforcement boundary. This filter runs inside the
 * Spring Security chain, after authentication has populated the
 * {@link SecurityContextHolder}, and rejects mutating requests from demo
 * principals against the high-impact financial/security admin surface:
 *
 * <ul>
 *   <li>payment decisions: {@code PATCH /api/v1/admin/payments/{id}} (review)
 *       and {@code PATCH /api/v1/admin/payments/{id}/refund} (AdminPaymentController)</li>
 *   <li>AI-credit adjustments: {@code POST /api/v1/admin/ai-credits/grant} and
 *       {@code PUT /api/v1/admin/ai-credits/tier} (AdminAiCreditController)</li>
 *   <li>identity/role/security admin surface: {@code /api/v1/users/admin/**}
 *       and its {@code /api/v1/admin/users/**} alias, so a future user-CRUD
 *       controller on those paths cannot silently bypass the boundary</li>
 *   <li>shared-credential rotation: {@code POST /api/v1/auth/change-password}
 *       (AuthController) — demo personas use fixed published passwords, so a
 *       rotation is a persistent shared-security mutation that would lock out
 *       every other demo visitor</li>
 * </ul>
 *
 * <p>Everything else stays usable for demo principals: GET reads, patient
 * booking/chat journeys ({@code /api/v1/appointments/**},
 * {@code /api/v1/ai/conversations/**}) and synthetic/resettable CMS, catalog
 * and clinical-content writes ({@code /api/v1/admin/cms/**},
 * {@code /api/v1/admin/ai}, {@code /api/v1/admin/schedules/**}, ...).
 */
@Component
public class DemoMutationBoundaryFilter extends OncePerRequestFilter {

    public static final String DEMO_MUTATION_FORBIDDEN = "DEMO_MUTATION_FORBIDDEN";

    /**
     * High-impact mutation surface blocked for demo principals. Keep this list
     * derived from the real controllers (see class javadoc); do not widen it to
     * synthetic, resettable content areas that the demo experience needs.
     */
    private static final List<String> BLOCKED_MUTATION_PATHS = List.of(
        "/api/v1/admin/payments/**",
        "/api/v1/admin/ai-credits/**",
        "/api/v1/users/admin/**",
        "/api/v1/admin/users/**",
        "/api/v1/auth/change-password"
    );

    private final DemoBoundaryProperties properties;
    private final ObjectMapper objectMapper;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public DemoMutationBoundaryFilter(DemoBoundaryProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return properties.getBoundary() == DemoBoundaryProperties.BoundaryMode.OFF;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!isMutation(request.getMethod()) || !isDemoPrincipal()) {
            filterChain.doFilter(request, response);
            return;
        }
        String path = request.getRequestURI();
        for (String pattern : BLOCKED_MUTATION_PATHS) {
            if (pathMatcher.match(pattern, path)) {
                writeForbidden(request, response);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean isMutation(String method) {
        return HttpMethod.POST.matches(method)
            || HttpMethod.PUT.matches(method)
            || HttpMethod.PATCH.matches(method)
            || HttpMethod.DELETE.matches(method);
    }

    private boolean isDemoPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getPrincipal() instanceof HealthcareUserPrincipal principal
            && principal.isDemo();
    }

    private void writeForbidden(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiError error = new ApiError(
            HttpStatus.FORBIDDEN.value(),
            HttpStatus.FORBIDDEN.getReasonPhrase(),
            "Demo accounts cannot perform this action. High-impact financial and "
                + "security mutations are disabled for synthetic demo identities.",
            request.getRequestURI(),
            List.of(),
            DEMO_MUTATION_FORBIDDEN
        );
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
}
