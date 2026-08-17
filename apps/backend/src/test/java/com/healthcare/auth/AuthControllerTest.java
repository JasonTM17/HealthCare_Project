package com.healthcare.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {
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
}
