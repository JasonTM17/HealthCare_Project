package com.healthcare.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Wukong-verified finding: changing a password from one browser session must
 * revoke every other credential of the user (other browser sessions and all
 * refresh tokens) while keeping the caller's own session alive.
 */
@TestPropertySource(properties = {
    "app.security.bff.service-token=0123456789abcdef0123456789abcdef",
    "app.security.bff.allowed-origins=https://healthcare.test",
    "app.cors.allowed-origins=https://healthcare.test"
})
class ChangePasswordSessionRevocationTest extends AbstractIntegrationTest {

    private static final String BFF_TOKEN = "0123456789abcdef0123456789abcdef";
    private static final String ORIGIN = "https://healthcare.test";
    private static final String OLD_PASSWORD = "Str0ng!Pass";
    private static final String NEW_PASSWORD = "N3w!Password";

    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrowserSessionService browserSessionService;

    @MockitoBean private EmailSender emailSender;

    @Test
    void changePasswordFromOneSessionRevokesOtherSessionsAndAllRefreshTokensOnly() throws Exception {
        User user = createVerifiedPatient("chpwd.sessions@example.com", OLD_PASSWORD);

        BrowserSessionService.IssuedBrowserSession callerSession =
            browserSessionService.issue(user.getId());
        BrowserSessionService.IssuedBrowserSession otherSession =
            browserSessionService.issue(user.getId());

        // A second credential lane (legacy bearer client on another device),
        // rotated once so the token exercised at the end is the replacement —
        // revocation must cover it, not just the originally stored row. This
        // rotation also proves the refresh lane was alive before the change.
        String originalToken = login("chpwd.sessions@example.com", OLD_PASSWORD)
            .get("refreshToken").asText();
        String activeToken = refresh(originalToken).get("refreshToken").asText();

        // Pre-fix sanity: both browser sessions and the refresh token work.
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME,
                    callerSession.rawSessionSecret())))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME,
                    otherSession.rawSessionSecret())))
            .andExpect(status().isOk());

        changePasswordFromSession(callerSession, OLD_PASSWORD, NEW_PASSWORD);

        // The caller's own session survives the password change.
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME,
                    callerSession.rawSessionSecret())))
            .andExpect(status().isOk());

        // Every other browser session is dead. The session-state assertions
        // must precede the refresh probe: refreshing a revoked token is reuse
        // detection, which revokes everything including the caller's session.
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME,
                    otherSession.rawSessionSecret())))
            .andExpect(status().isUnauthorized());
        assertThat(browserSessionService.resolveAndTouch(otherSession.rawSessionSecret())).isEmpty();
        assertThat(browserSessionService.resolveAndTouch(callerSession.rawSessionSecret())).isPresent();

        // The replacement refresh token is dead too.
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(activeToken)))
            .andExpect(status().isUnauthorized());
        assertThat(refreshTokenRepository.findAllActiveByUserId(user.getId())).isEmpty();
    }

    @Test
    void changePasswordFromBearerLaneRevokesEveryBrowserSession() throws Exception {
        User user = createVerifiedPatient("chpwd.bearer@example.com", OLD_PASSWORD);
        BrowserSessionService.IssuedBrowserSession ambientSession =
            browserSessionService.issue(user.getId());
        String accessToken = objectMapper.readTree(
            mockMvc.perform(post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {"email":"chpwd.bearer@example.com","password":"%s"}
                        """.formatted(OLD_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()
        ).get("accessToken").asText();

        mockMvc.perform(post("/api/v1/auth/change-password")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"currentPassword":"%s","newPassword":"%s"}
                    """.formatted(OLD_PASSWORD, NEW_PASSWORD)))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME,
                    ambientSession.rawSessionSecret())))
            .andExpect(status().isUnauthorized());
    }

    private void changePasswordFromSession(
            BrowserSessionService.IssuedBrowserSession session,
            String currentPassword,
            String newPassword) throws Exception {
        mockMvc.perform(post("/api/v1/auth/change-password")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .header(BrowserSessionService.CSRF_HEADER_NAME, session.rawCsrfSecret())
                .cookie(
                    new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session.rawSessionSecret()),
                    new Cookie(BrowserSessionService.CSRF_COOKIE_NAME, session.rawCsrfSecret())
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"currentPassword":"%s","newPassword":"%s"}
                    """.formatted(currentPassword, newPassword)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").exists());
    }

    private JsonNode login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"%s","password":"%s"}
                    """.formatted(email, password)))
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

    private User createVerifiedPatient(String email, String password) {
        Role role = roleRepository.findByCode("PATIENT").orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName("Change Password Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        User saved = userRepository.saveAndFlush(user);
        jdbcTemplate.update(
            "INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)",
            saved.getId(),
            role.getId()
        );
        return userRepository.findWithRolesById(saved.getId()).orElseThrow();
    }
}
