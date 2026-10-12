package com.healthcare.hospital;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PackageImageIntegrationTest extends AbstractIntegrationTest {
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Autowired RoleRepository roles;
    @Autowired JwtTokenProvider tokens;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void normalAdminImageWritesPersistAcrossPublicReadsAndRejectStaleOverwrite() throws Exception {
        String admin = bearer("ADMIN");
        ObjectNode payload = mapper.createObjectNode().put("name", "[Minh họa] Gói ảnh")
            .put("slug", "owned-image-package").put("description", "Dữ liệu kiểm thử riêng")
            .put("price", 100000).put("active", true).put("imageUrl", "/images/packages/heart-screening.jpg");
        JsonNode created = mapper.readTree(mockMvc.perform(post("/api/v1/admin/packages").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mockMvc.perform(get("/api/v1/hospital/packages/owned-image-package"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(payload.path("imageUrl").asText()));
        mockMvc.perform(get("/api/v1/hospital/packages"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].imageUrl").value(payload.path("imageUrl").asText()));
        assertThat(jdbcTemplate.queryForObject("select image_url from packages where slug='owned-image-package'", String.class))
            .isEqualTo(payload.path("imageUrl").asText());

        long version = created.path("version").asLong();
        payload.put("expectedVersion", version).put("imageUrl", "/images/packages/child-checkup.jpg");
        JsonNode updated = mapper.readTree(mockMvc.perform(put("/api/v1/admin/packages/owned-image-package")
            .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(updated.path("version").asLong()).isEqualTo(version + 1);
        payload.put("price", 999999);
        mockMvc.perform(put("/api/v1/admin/packages/owned-image-package").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isConflict());
        assertThat(jdbcTemplate.queryForObject("select price from packages where slug='owned-image-package'", java.math.BigDecimal.class))
            .isEqualByComparingTo("100000");

        payload.remove("imageUrl"); payload.remove("expectedVersion"); payload.put("price", 100000);
        mockMvc.perform(put("/api/v1/admin/packages/owned-image-package").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value("/images/packages/child-checkup.jpg"));
        payload.put("imageUrl", "");
        mockMvc.perform(put("/api/v1/admin/packages/owned-image-package").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").isEmpty());
        assertThat(jdbcTemplate.queryForObject("select count(*) from flyway_schema_history where version='124' and success", Integer.class)).isEqualTo(1);
    }

    @Test
    void unauthorizedAndUnsafeImagesCannotCreatePackage() throws Exception {
        ObjectNode payload = mapper.createObjectNode().put("name", "Owned negative package").put("slug", "owned-negative-package")
            .put("price", 100000).put("active", true).put("imageUrl", "javascript:alert(1)");
        mockMvc.perform(post("/api/v1/admin/packages").contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
            .andExpect(status().isUnauthorized());
        for (String role : new String[]{"PATIENT", "DOCTOR"}) {
            mockMvc.perform(post("/api/v1/admin/packages").header("Authorization", bearer(role))
                .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/v1/admin/packages").header("Authorization", bearer("ADMIN"))
            .contentType(MediaType.APPLICATION_JSON).content(payload.toString())).andExpect(status().isBadRequest());
        assertThat(packageRepository.count()).isZero();
    }

    private String bearer(String role) {
        User user = new TransactionTemplate(transactions).execute(status -> {
            User fixture = new User(); fixture.setEmail("package-image-" + UUID.randomUUID() + "@example.invalid");
            fixture.setDisplayName("Owned image actor"); fixture.setPasswordHash("unused-fixture-hash");
            fixture.setStatus("ACTIVE"); fixture.setEmailVerified(true); fixture.setDemo(false);
            fixture.setCreatedAt(OffsetDateTime.now()); fixture.setUpdatedAt(fixture.getCreatedAt());
            fixture.addRole(roles.findByCode(role).orElseThrow());
            return userRepository.saveAndFlush(fixture);
        });
        return "Bearer " + tokens.generateAccessToken(user.getId(), user.getEmail(), user.getSecurityVersion());
    }
}
