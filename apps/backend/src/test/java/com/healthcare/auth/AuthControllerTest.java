package com.healthcare.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerTest extends AbstractIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registerCreatesPatientAndDoesNotExposePasswordHash() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "Patient.One@Example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Patient One"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists())
            .andExpect(jsonPath("$.refreshToken").exists())
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("tokenType").asText()).isEqualTo("Bearer");
        assertThat(body.get("user").get("email").asText()).isEqualTo("patient.one@example.com");
        assertThat(body.get("user").get("roles").toString()).contains("PATIENT");
    }

    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        String body = """
            {
              "email": "duplicate@example.com",
              "password": "Str0ng!Pass",
              "displayName": "Duplicate Patient"
            }
            """;

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict());
    }

    @Test
    void loginReturnsTokens() throws Exception {
        register("login.patient@example.com", "Str0ng!Pass", "Login Patient");

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "login.patient@example.com",
                      "password": "Str0ng!Pass"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists())
            .andExpect(jsonPath("$.refreshToken").exists())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("user").get("email").asText()).isEqualTo("login.patient@example.com");
    }

    @Test
    void invalidLoginReturnsUnauthorized() throws Exception {
        register("invalid.login@example.com", "Str0ng!Pass", "Invalid Login");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "invalid.login@example.com",
                      "password": "Wrong!Pass1"
                    }
                    """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void logoutWorksWhenAuthenticated() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout"))
            .andExpect(status().isOk());
    }

    @Test
    void refreshRotatesTokenAndRejectsReuse() throws Exception {
        JsonNode registration = register("refresh.patient@example.com", "Str0ng!Pass", "Refresh Patient");
        String originalRefreshToken = registration.get("refreshToken").asText();

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(originalRefreshToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.refreshToken").exists())
            .andReturn();

        JsonNode refreshed = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
        assertThat(refreshed.get("refreshToken").asText()).isNotEqualTo(originalRefreshToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(originalRefreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesActiveRefreshTokens() throws Exception {
        JsonNode registration = register("logout.patient@example.com", "Str0ng!Pass", "Logout Patient");
        String accessToken = registration.get("accessToken").asText();
        String refreshToken = registration.get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/logout")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshReuseRevokesTheReplacementToken() throws Exception {
        JsonNode registration = register("reuse.patient@example.com", "Str0ng!Pass", "Reuse Patient");
        String originalRefreshToken = registration.get("refreshToken").asText();
        String replacementRefreshToken = refresh(originalRefreshToken).get("refreshToken").asText();

        refreshFails(originalRefreshToken);
        refreshFails(replacementRefreshToken);
    }

    @Test
    void administratorBoundaryRejectsPatientRole() throws Exception {
        JsonNode registration = register("patient.role@example.com", "Str0ng!Pass", "Patient Role");

        mockMvc.perform(get("/api/v1/users/admin/access")
                .header("Authorization", "Bearer " + registration.get("accessToken").asText()))
            .andExpect(status().isForbidden());
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessToken() throws Exception {
        JsonNode registration = register("type.guard@example.com", "Str0ng!Pass", "Type Guard");
        String refreshToken = registration.get("refreshToken").asText();

        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + refreshToken))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void accessTokenCannotBeUsedForRefresh() throws Exception {
        JsonNode registration = register("type.guard.refresh@example.com", "Str0ng!Pass", "Type Guard Refresh");
        String accessToken = registration.get("accessToken").asText();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(accessToken)))
            .andExpect(status().isUnauthorized());
    }

    private JsonNode register(String email, String password, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "%s",
                      "displayName": "%s"
                    }
                    """.formatted(email, password, displayName)))
            .andExpect(status().isOk())
            .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode refresh(String refreshToken) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isOk())
            .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void refreshFails(String refreshToken) throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }
}
