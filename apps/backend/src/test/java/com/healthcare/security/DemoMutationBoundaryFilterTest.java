package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the HC-01/D-01 demo mutation boundary, following the plain
 * servlet-filter style of {@code RequestRateLimitFilterTest}.
 */
class DemoMutationBoundaryFilterTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Demo principal is blocked from a payment decision with 403 DEMO_MUTATION_FORBIDDEN")
    void blocksDemoPaymentReview() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "PATCH",
            "/api/v1/admin/payments/9f6a2bd8-2bd2-4f05-9a44-3ff5a0f5b021/refund", demoPrincipal(), downstream);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("DEMO_MUTATION_FORBIDDEN");
        assertThat(downstream).hasValue(0);
    }

    @Test
    @DisplayName("Demo principal is blocked from AI-credit grant and tier adjustments")
    void blocksDemoAiCreditAdjustments() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse grant = invoke(filter, "POST", "/api/v1/admin/ai-credits/grant",
            demoPrincipal(), downstream);
        MockHttpServletResponse tier = invoke(filter, "PUT", "/api/v1/admin/ai-credits/tier",
            demoPrincipal(), downstream);

        assertThat(grant.getStatus()).isEqualTo(403);
        assertThat(tier.getStatus()).isEqualTo(403);
        assertThat(downstream).hasValue(0);
    }

    @Test
    @DisplayName("Demo principal is blocked from the user/identity admin surface")
    void blocksDemoUserAdminMutations() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse usersAdmin = invoke(filter, "POST", "/api/v1/users/admin/roles",
            demoPrincipal(), downstream);
        MockHttpServletResponse adminUsers = invoke(filter, "DELETE", "/api/v1/admin/users/1234",
            demoPrincipal(), downstream);

        assertThat(usersAdmin.getStatus()).isEqualTo(403);
        assertThat(adminUsers.getStatus()).isEqualTo(403);
        assertThat(downstream).hasValue(0);
    }

    @Test
    @DisplayName("Demo principal can still read the blocked admin surface (GET passes)")
    void allowsDemoReadsOfBlockedSurface() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "GET", "/api/v1/admin/payments",
            demoPrincipal(), downstream);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(1);
    }

    @Test
    @DisplayName("Demo patient booking and chat journeys are not intercepted")
    void allowsDemoBookingAndChatMutations() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse cancel = invoke(filter, "POST", "/api/v1/appointments/BK-240912-0001/cancel",
            demoPrincipal(), downstream);
        MockHttpServletResponse chat = invoke(filter, "POST", "/api/v1/ai/conversations",
            demoPrincipal(), downstream);
        MockHttpServletResponse ownPayment = invoke(filter, "POST",
            "/api/v1/patient/appointments/9f6a2bd8-2bd2-4f05-9a44-3ff5a0f5b021/payment",
            demoPrincipal(), downstream);

        assertThat(cancel.getStatus()).isEqualTo(200);
        assertThat(chat.getStatus()).isEqualTo(200);
        assertThat(ownPayment.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(3);
    }

    @Test
    @DisplayName("Non-demo principal is unaffected on the blocked surface")
    void allowsNonDemoPrivilegedMutations() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "PATCH", "/api/v1/admin/payments/abc/refund",
            nonDemoPrincipal(), downstream);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(1);
    }

    @Test
    @DisplayName("Unauthenticated requests pass through untouched (authorization decides later)")
    void passesUnauthenticatedRequestsThrough() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "POST", "/api/v1/admin/payments/abc/refund",
            null, downstream);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(1);
    }

    @Test
    @DisplayName("boundary=off disables the filter entirely")
    void boundaryOffDisablesTheFilter() throws Exception {
        DemoBoundaryProperties off = enforce();
        off.setBoundary("off");
        DemoMutationBoundaryFilter filter = filter(off);
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "PATCH", "/api/v1/admin/payments/abc/refund",
            demoPrincipal(), downstream);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(1);
    }

    @Test
    @DisplayName("OPTIONS preflight is never blocked")
    void allowsCorsPreflight() throws Exception {
        DemoMutationBoundaryFilter filter = filter(enforce());
        AtomicInteger downstream = new AtomicInteger();

        MockHttpServletResponse response = invoke(filter, "OPTIONS", "/api/v1/admin/payments/abc",
            demoPrincipal(), downstream);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(downstream).hasValue(1);
    }

    private DemoMutationBoundaryFilter filter(DemoBoundaryProperties properties) {
        return new DemoMutationBoundaryFilter(properties, objectMapper);
    }

    private DemoBoundaryProperties enforce() {
        return new DemoBoundaryProperties();
    }

    private MockHttpServletResponse invoke(
            DemoMutationBoundaryFilter filter,
            String method,
            String path,
            UserDetails principal,
            AtomicInteger downstream) throws Exception {
        if (principal != null) {
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        }
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> downstream.incrementAndGet());
        return response;
    }

    private HealthcareUserPrincipal demoPrincipal() {
        return principal(true);
    }

    private HealthcareUserPrincipal nonDemoPrincipal() {
        return principal(false);
    }

    private HealthcareUserPrincipal principal(boolean demo) {
        return HealthcareUserPrincipal.from(Fixtures.user(demo));
    }

    /** Test fixture holder kept out of the production source tree. */
    static final class Fixtures {
        private Fixtures() {
        }

        static com.healthcare.user.entity.User user(boolean demo) {
            com.healthcare.user.entity.User user = new com.healthcare.user.entity.User();
            user.setId(UUID.randomUUID());
            user.setEmail(demo ? "admin@healthcare.com" : "operator@example.com");
            user.setPasswordHash("bcrypt-hash");
            user.setDisplayName("Fixture User");
            user.setStatus("ACTIVE");
            user.setDemo(demo);
            return user;
        }
    }
}
