package com.healthcare.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.security.JwtProperties;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerTest extends TestcontainersIntegrationTest {
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private JwtProperties jwtProperties;

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
    void registrationWithPhoneCreatesLinkedPatientProfile() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "portal.patient@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Portal Patient",
                      "phone": "090 123-4567"
                    }
                    """))
            .andExpect(status().isOk());

        var user = userRepository.findByEmail("portal.patient@example.com").orElseThrow();
        var profile = patientProfileRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(profile.getPhone()).isEqualTo("0901234567");
        assertThat(profile.getFullName()).isEqualTo("Portal Patient");
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
    void disabledAccountLoginUsesGenericUnauthorizedResponse() throws Exception {
        register("disabled.login@example.com", "Str0ng!Pass", "Disabled Login");

        userRepository.findByEmail("disabled.login@example.com")
            .ifPresent(user -> {
                user.setStatus("DISABLED");
                userRepository.save(user);
            });

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "disabled.login@example.com",
                      "password": "Str0ng!Pass"
                    }
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid email or password"));
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
    void refreshRejectsWhenStoredSessionOwnerDoesNotMatchSignedSubject() throws Exception {
        JsonNode registration = register("session.owner@example.com", "Str0ng!Pass", "Session Owner");
        register("other.owner@example.com", "Str0ng!Pass", "Other Owner");
        String refreshToken = registration.get("refreshToken").asText();

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(hashToken(refreshToken)).orElseThrow();
        storedToken.setUser(userRepository.findByEmail("other.owner@example.com").orElseThrow());
        refreshTokenRepository.saveAndFlush(storedToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
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

    @Test
    void structurallyInvalidSignedRefreshTokenReturnsUnauthorized() throws Exception {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        String malformedToken = Jwts.builder()
            .subject("not-a-uuid")
            .claim("type", "refresh")
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(900)))
            .signWith(key)
            .compact();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(malformedToken)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid email or password"));
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

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new AssertionError("SHA-256 unavailable", e);
        }
    }

    @Test
    void disabledUserCannotRefreshTokens() throws Exception {
        JsonNode registration = register("disabled.refresh@example.com", "Str0ng!Pass", "Disabled Refresh");
        String refreshToken = registration.get("refreshToken").asText();

        userRepository.findByEmail("disabled.refresh@example.com")
            .ifPresent(user -> {
                user.setStatus("DISABLED");
                userRepository.save(user);
            });

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void deletedUserTokenIsRejectedWithUnauthorized() throws Exception {
        JsonNode registration = register("deleted.user@example.com", "Str0ng!Pass", "Deleted User");
        String accessToken = registration.get("accessToken").asText();

        userRepository.findByEmail("deleted.user@example.com").ifPresent(userRepository::delete);

        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isUnauthorized());
    }
}
