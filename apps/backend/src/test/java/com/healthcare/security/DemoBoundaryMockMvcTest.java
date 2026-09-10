package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Endpoint-level proof (HC-01/D-01) that a demo principal receives 403 with
 * the stable {@code DEMO_MUTATION_FORBIDDEN} code from a payment-decision
 * shaped route, while non-demo principals and the patient booking journey are
 * untouched. Uses a stub controller with the real boundary filter; no
 * Spring context or database required.
 */
class DemoBoundaryMockMvcTest {

    private final DemoBoundaryProperties properties = new DemoBoundaryProperties();
    private final DemoMutationBoundaryFilter boundaryFilter =
        new DemoMutationBoundaryFilter(properties, new ObjectMapper().findAndRegisterModules());
    private final StubAdminController controller = new StubAdminController();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .addFilters(boundaryFilter)
            .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Demo principal PATCHing a payment decision gets 403 DEMO_MUTATION_FORBIDDEN")
    void demoPrincipalBlockedFromPaymentDecision() throws Exception {
        setPrincipal(HealthcareUserPrincipal.from(DemoMutationBoundaryFilterTest.Fixtures.user(true)));

        mockMvc.perform(patch("/api/v1/admin/payments/{id}/refund", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"demo probe\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("DEMO_MUTATION_FORBIDDEN"));

        assertThat(controller.paymentDecisions).isZero();
    }

    @Test
    @DisplayName("Non-demo principal PATCHing the same route proceeds (200 from stub)")
    void nonDemoPrincipalUnaffected() throws Exception {
        setPrincipal(HealthcareUserPrincipal.from(DemoMutationBoundaryFilterTest.Fixtures.user(false)));

        mockMvc.perform(patch("/api/v1/admin/payments/{id}/refund", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"operator action\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVIEWED"));

        assertThat(controller.paymentDecisions).isEqualTo(1);
    }

    @Test
    @DisplayName("Demo principal POSTing the patient booking journey proceeds")
    void demoBookingJourneyNotIntercepted() throws Exception {
        setPrincipal(HealthcareUserPrincipal.from(DemoMutationBoundaryFilterTest.Fixtures.user(true)));

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"doctorId\":\"" + UUID.randomUUID() + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("HELD"));

        assertThat(controller.bookingMutations).isEqualTo(1);
    }

    private void setPrincipal(UserDetails principal) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    /** Minimal stand-ins for the real routes under the boundary filter. */
    @RestController
    static class StubAdminController {

        int paymentDecisions;
        int bookingMutations;

        @PatchMapping("/api/v1/admin/payments/{paymentId}/refund")
        java.util.Map<String, String> refund(@PathVariable UUID paymentId) {
            paymentDecisions++;
            return java.util.Map.of("status", "REVIEWED", "paymentId", paymentId.toString());
        }

        @PostMapping("/api/v1/appointments/hold")
        java.util.Map<String, String> hold() {
            bookingMutations++;
            return java.util.Map.of("status", "HELD");
        }
    }
}
