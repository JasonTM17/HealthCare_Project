package com.healthcare.cms;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.service.CmsPublishedContentCache;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CmsContentIntegrationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private CmsPublishedContentCache cache;
    @Autowired private CmsContentChangeRepository changeRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    @BeforeEach
    void clearPublishedCache() {
        cache.clear();
    }

    @Test
    void adminCanPersistPublishedContentAndPublicCanReadIt() throws Exception {
        String body = request("HERO", "PUBLISHED", 0,
            "{\"eyebrow\":\"Local\",\"title\":\"A safe hero\",\"body\":\"Fictional content\",\"ctaLabel\":\"Explore\",\"ctaHref\":\"/services\"}");

        mockMvc.perform(put("/api/v1/admin/cms/content/homepage.hero")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slotKey").value("homepage.hero"))
            .andExpect(jsonPath("$.status").value("PUBLISHED"))
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.payload.title").value("A safe hero"));

        mockMvc.perform(get("/api/v1/cms/content/homepage.hero"))
            .andExpect(status().isOk())
            .andExpect(header -> assertThat(header.getResponse().getHeader("Cache-Control")).contains("no-store"))
            .andExpect(jsonPath("$.payload.title").value("A safe hero"))
            .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void onlyAdminCanMutateCmsContent() throws Exception {
        String body = request("NOTICE", "DRAFT", 0, "{\"title\":\"Draft\",\"body\":\"Not public yet\"}");

        mockMvc.perform(put("/api/v1/admin/cms/content/access-check")
                .header("Authorization", bearer("PATIENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/admin/cms/content/access-check")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unsafeOrUnknownPayloadFieldsAreRejected() throws Exception {
        String unsafe = request("HERO", "PUBLISHED", 0, "{\"title\":\"<script>alert(1)</script>\"}");
        mockMvc.perform(put("/api/v1/admin/cms/content/unsafe-content")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(unsafe))
            .andExpect(status().isBadRequest());

        String unknown = request("HERO", "PUBLISHED", 0, "{\"title\":\"Safe\",\"html\":\"not allowed\"}");
        mockMvc.perform(put("/api/v1/admin/cms/content/unknown-field")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(unknown))
            .andExpect(status().isBadRequest());

        String singleBackslash = request("HERO", "PUBLISHED", 0, "{\"title\":\"Safe\",\"ctaHref\":\"/care\\\\path\"}");
        mockMvc.perform(put("/api/v1/admin/cms/content/single-backslash")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(singleBackslash))
            .andExpect(status().isBadRequest());
    }

    @Test
    void staleExpectedVersionIsRejectedWithoutOverwritingNewerContent() throws Exception {
        String create = request("NOTICE", "PUBLISHED", 0, "{\"title\":\"First\",\"body\":\"Initial\"}");
        String update = request("NOTICE", "PUBLISHED", 1, "{\"title\":\"Second\",\"body\":\"Current\"}");
        String stale = request("NOTICE", "PUBLISHED", 1, "{\"title\":\"Stale\",\"body\":\"Must not win\"}");

        mockMvc.perform(put("/api/v1/admin/cms/content/versioned-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(create))
            .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/admin/cms/content/versioned-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(update))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(put("/api/v1/admin/cms/content/versioned-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(stale))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/cms/content/versioned-slot"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.payload.title").value("Second"))
            .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void draftIsHiddenUntilPublishedAndUnpublishRemovesIt() throws Exception {
        String draft = request("RICH_TEXT", "DRAFT", 0, "{\"title\":\"Draft title\",\"body\":\"Draft body\"}");
        String publish = request("RICH_TEXT", "PUBLISHED", 1, "{\"title\":\"Published title\",\"body\":\"Published body\"}");
        String unpublish = request("RICH_TEXT", "DRAFT", 2, "{\"title\":\"Published title\",\"body\":\"Published body\"}");

        mockMvc.perform(put("/api/v1/admin/cms/content/publishable-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(draft))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(1));
        mockMvc.perform(get("/api/v1/cms/content/publishable-slot"))
            .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/v1/admin/cms/content/publishable-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(publish))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(2));
        mockMvc.perform(get("/api/v1/cms/content/publishable-slot"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.payload.title").value("Published title"));

        mockMvc.perform(put("/api/v1/admin/cms/content/publishable-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(unpublish))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(3));
        mockMvc.perform(get("/api/v1/cms/content/publishable-slot"))
            .andExpect(status().isNotFound());
    }

    @Test
    void sseEndpointReturnsBoundedPublicEventShape() throws Exception {
        String body = request("NOTICE", "PUBLISHED", 0, "{\"title\":\"SSE title\",\"body\":\"SSE body\"}");
        mockMvc.perform(put("/api/v1/admin/cms/content/sse-slot")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(get("/api/v1/cms/content/events").param("after", "0"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.request().asyncStarted())
            .andReturn();
        assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(result.getResponse().getContentType()).contains(MediaType.TEXT_EVENT_STREAM_VALUE);
        String stream = result.getResponse().getContentAsString();

        assertThat(stream).contains("event:ready")
            .contains("event:cms-content-changed")
            .contains("\"slotKey\":\"sse-slot\"")
            .contains("\"version\":1")
            .doesNotContain("payload")
            .doesNotContain("SSE body");
        assertThat(changeRepository.findTopByOrderByIdDesc()).isPresent();
    }

    private String bearer(String roleCode) {
        User user = new TransactionTemplate(transactionManager).execute(status -> {
            User candidate = new User();
            candidate.setEmail("cms." + roleCode.toLowerCase() + "." + UUID.randomUUID() + "@healthcare.local");
            candidate.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
            candidate.setDisplayName("CMS Test User");
            candidate.setStatus("ACTIVE");
            candidate.setCreatedAt(OffsetDateTime.now());
            candidate.setUpdatedAt(OffsetDateTime.now());
            candidate.addRole(roleRepository.findByCode(roleCode).orElseThrow());
            return userRepository.saveAndFlush(candidate);
        });
        if (user == null) {
            throw new IllegalStateException("CMS test user transaction did not commit");
        }
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private String request(String componentType, String status, long expectedVersion, String payload) {
        return "{\"componentType\":\"%s\",\"payload\":%s,\"status\":\"%s\",\"expectedVersion\":%d}"
            .formatted(componentType, payload, status, expectedVersion);
    }
}
