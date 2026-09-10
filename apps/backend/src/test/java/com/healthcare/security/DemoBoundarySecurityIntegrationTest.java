package com.healthcare.security;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Direct-API negative mutation proof for the demo trust boundary (HC-01,
 * decision D-01) through the real security chain: authentication filters,
 * the {@link DemoMutationBoundaryFilter} choke point, authorization and the
 * controller mapping.
 */
class DemoBoundarySecurityIntegrationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void demoAdminCannotDecidePaymentsThroughDirectApi() throws Exception {
        String bearer = bearerFor(true);

        mockMvc.perform(patch("/api/v1/admin/payments/{paymentId}/refund", UUID.randomUUID())
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refundReference\":\"REF-100001\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("DEMO_MUTATION_FORBIDDEN"));
    }

    @Test
    void demoAdminPaymentReadsStayAvailable() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments")
                .header("Authorization", bearerFor(true)))
            .andExpect(status().isOk());
    }

    @Test
    void nonDemoAdminStillReachesThePaymentController() throws Exception {
        // The boundary must not touch ordinary principals: with no such
        // payment the controller/service itself answers 404, proving the
        // request passed the demo filter instead of being short-circuited.
        mockMvc.perform(patch("/api/v1/admin/payments/{paymentId}/refund", UUID.randomUUID())
                .header("Authorization", bearerFor(false))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refundReference\":\"REF-100002\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.not("DEMO_MUTATION_FORBIDDEN")));
    }

    @Test
    void demoAdminKeepsSyntheticResettableCmsWriteAccess() throws Exception {
        String body = """
            {"componentType":"NOTICE","payload":{"title":"Demo fixture","body":"Resettable synthetic content"},
             "status":"DRAFT","expectedVersion":0}
            """;

        mockMvc.perform(put("/api/v1/admin/cms/content/about.body")
                .header("Authorization", bearerFor(true))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    private String bearerFor(boolean demo) {
        User user = new TransactionTemplate(transactionManager).execute(status -> {
            User candidate = new User();
            candidate.setEmail("boundary." + (demo ? "demo." : "") + UUID.randomUUID() + "@healthcare.local");
            candidate.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
            candidate.setDisplayName("Boundary Probe");
            candidate.setStatus("ACTIVE");
            candidate.setDemo(demo);
            candidate.setCreatedAt(OffsetDateTime.now());
            candidate.setUpdatedAt(OffsetDateTime.now());
            candidate.addRole(roleRepository.findByCode("ADMIN").orElseThrow());
            return userRepository.saveAndFlush(candidate);
        });
        assertThat(user).isNotNull();
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }
}
