package com.healthcare.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void openApiConfigurationExposesEnterpriseTagsAndSecuritySchemes() {
        OpenApiConfig config = new OpenApiConfig();
        OpenAPI openAPI = config.healthcareOpenAPI();

        assertThat(openAPI).isNotNull();
        assertThat(openAPI.getInfo()).isNotNull();
        assertThat(openAPI.getInfo().getTitle()).contains("HealthCare");
        assertThat(openAPI.getInfo().getVersion()).isEqualTo("1.0.0");

        // Verify configured server URLs
        List<String> serverUrls = openAPI.getServers().stream().map(io.swagger.v3.oas.models.servers.Server::getUrl).toList();
        assertThat(serverUrls).contains(
            "/",
            "https://healthcare-beta-backend-4wb7.onrender.com",
            "https://www.healthcare.id.vn/api/v1",
            "http://localhost:8080"
        );

        // Verify all 14 tags are present
        List<String> tagNames = openAPI.getTags().stream().map(Tag::getName).toList();
        assertThat(tagNames).contains(
            "Authentication",
            "Public Catalog",
            "Appointment & Booking",
            "Clinical Records & Prescriptions",
            "Patient Care Plans",
            "Tele-Consultation",
            "Health Q&A",
            "Payments & Invoices",
            "AI Health Assistant",
            "AI Clinical Review",
            "CMS & Content Delivery",
            "User Profile & Preferences",
            "File & Object Storage",
            "Synthetic Documents"
        );

        // Verify security schemes
        assertThat(openAPI.getComponents()).isNotNull();
        assertThat(openAPI.getComponents().getSecuritySchemes()).containsKey("bearerAuth");
        assertThat(openAPI.getComponents().getSecuritySchemes()).containsKey("bffTokenAuth");

        SecurityScheme bearer = openAPI.getComponents().getSecuritySchemes().get("bearerAuth");
        assertThat(bearer.getType()).isEqualTo(SecurityScheme.Type.HTTP);
        assertThat(bearer.getScheme()).isEqualTo("bearer");
        assertThat(bearer.getBearerFormat()).isEqualTo("JWT");

        SecurityScheme bff = openAPI.getComponents().getSecuritySchemes().get("bffTokenAuth");
        assertThat(bff.getType()).isEqualTo(SecurityScheme.Type.APIKEY);
        assertThat(bff.getName()).isEqualTo("X-BFF-Service-Token");
    }
}
