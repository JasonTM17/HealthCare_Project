package com.healthcare.auth;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.repository.BrowserSessionRepository;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = {
    "app.security.bff.service-token=0123456789abcdef0123456789abcdef",
    "app.security.bff.allowed-origins=https://healthcare.test",
    "app.cors.allowed-origins=https://healthcare.test"
})
class BrowserSessionSecurityIntegrationTest extends TestcontainersIntegrationTest {

    private static final String BFF_TOKEN = "0123456789abcdef0123456789abcdef";
    private static final String ORIGIN = "https://healthcare.test";

    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrowserSessionRepository browserSessionRepository;
    @Autowired private BrowserSessionService browserSessionService;

    @MockitoBean private EmailSender emailSender;
    private final AtomicReference<String> deliveredEmailBody = new AtomicReference<>("");

    @BeforeEach
    void captureEmail() {
        deliveredEmailBody.set("");
        doAnswer(invocation -> {
            deliveredEmailBody.set(invocation.getArgument(2, String.class));
            return null;
        }).when(emailSender).send(anyString(), anyString(), anyString());
    }

    @Test
    void trustedBffFirstLoginMintsHashOnlyCookiesWithoutBearerTokens() throws Exception {
        User user = createVerifiedPatient("browser.first@example.com", "Str0ng!Pass");

        MvcResult result = createPasswordSession("browser.first@example.com", "Str0ng!Pass")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("browser.first@example.com"))
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(jsonPath("$.refreshToken").doesNotExist())
            .andExpect(jsonPath("$.sessionSecret").doesNotExist())
            .andExpect(jsonPath("$.csrfSecret").doesNotExist())
            .andReturn();

        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String sessionHeader = cookieHeader(setCookies, BrowserSessionService.SESSION_COOKIE_NAME);
        String csrfHeader = cookieHeader(setCookies, BrowserSessionService.CSRF_COOKIE_NAME);
        String rawSession = cookieValue(sessionHeader);
        String rawCsrf = cookieValue(csrfHeader);

        assertThat(sessionHeader)
            .contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/")
            .doesNotContain("Domain=");
        assertThat(csrfHeader)
            .contains("Secure", "SameSite=Lax", "Path=/")
            .doesNotContain("HttpOnly", "Domain=");

        var persisted = browserSessionRepository.findAllByUserId(user.getId()).getFirst();
        assertThat(persisted.getSessionSecretHash())
            .isEqualTo(BrowserSessionService.sha256(rawSession))
            .isNotEqualTo(rawSession);
        assertThat(persisted.getCsrfSecretHash())
            .isEqualTo(BrowserSessionService.sha256(rawCsrf))
            .isNotEqualTo(rawCsrf);
        assertThat(result.getResponse().getContentAsString())
            .doesNotContain(rawSession, rawCsrf, "Bearer");

        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, rawSession)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("browser.first@example.com"));
    }

    @Test
    void firstLoginRejectsCrossOriginAndForgedBffCredential() throws Exception {
        createVerifiedPatient("browser.origin@example.com", "Str0ng!Pass");
        String body = passwordGrant("browser.origin@example.com", "Str0ng!Pass");

        mockMvc.perform(post("/api/v1/auth/browser-sessions")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", "https://evil.example")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/auth/browser-sessions")
                .header("X-Healthcare-Bff-Token", "forged-token")
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/auth/login")
                .header("X-Healthcare-Bff-Token", "", BFF_TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(browserSessionRepository.count()).isZero();
    }

    @Test
    void legacyBearerMintRoutesRejectTrustedBffAndDirectBrowserCors() throws Exception {
        createVerifiedPatient("browser.legacy@example.com", "Str0ng!Pass");

        List<RequestFixture> legacyRequests = List.of(
            new RequestFixture("/api/v1/auth/login", passwordGrant(
                "browser.legacy@example.com", "Str0ng!Pass")),
            new RequestFixture("/api/v1/auth/refresh", "{\"refreshToken\":\"not-issued\"}"),
            new RequestFixture("/api/v1/auth/email-verifications/confirm",
                "{\"email\":\"browser.legacy@example.com\",\"otp\":\"000000\"}"),
            new RequestFixture("/api/v1/auth/verify-email",
                "{\"email\":\"browser.legacy@example.com\",\"otp\":\"000000\"}"),
            new RequestFixture("/api/v1/auth/confirm-email",
                "{\"email\":\"browser.legacy@example.com\",\"otp\":\"000000\"}")
        );

        for (RequestFixture fixture : legacyRequests) {
            MvcResult result = mockMvc.perform(post(fixture.path())
                    .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(fixture.body()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andReturn();
            assertThat(result.getResponse().getContentAsString())
                .doesNotContain("accessToken", "refreshToken", "Bearer");
        }

        mockMvc.perform(options("/api/v1/auth/login")
                .header("Origin", ORIGIN)
                .header("Access-Control-Request-Method", "POST"))
            .andExpect(status().isForbidden())
            .andExpect(result -> assertThat(
                result.getResponse().getHeader("Access-Control-Allow-Origin")
            ).isNull());

        MvcResult directBrowser = mockMvc.perform(post("/api/v1/auth/login")
                .header("Origin", ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(passwordGrant("browser.legacy@example.com", "Str0ng!Pass")))
            .andExpect(status().isForbidden())
            .andReturn();
        assertThat(directBrowser.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
        assertThat(directBrowser.getResponse().getContentAsString())
            .doesNotContain("accessToken", "refreshToken", "Bearer");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(passwordGrant("browser.legacy@example.com", "Str0ng!Pass")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    void existingSessionRequiresCsrfAndRotationInvalidatesOldSecret() throws Exception {
        createVerifiedPatient("browser.rotate@example.com", "Str0ng!Pass");
        MvcResult first = createPasswordSession("browser.rotate@example.com", "Str0ng!Pass")
            .andExpect(status().isOk()).andReturn();
        String oldSession = cookieValue(cookieHeader(
            first.getResponse().getHeaders(HttpHeaders.SET_COOKIE),
            BrowserSessionService.SESSION_COOKIE_NAME
        ));
        String oldCsrf = cookieValue(cookieHeader(
            first.getResponse().getHeaders(HttpHeaders.SET_COOKIE),
            BrowserSessionService.CSRF_COOKIE_NAME
        ));

        mockMvc.perform(post("/api/v1/auth/browser-sessions")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, oldSession))
                .contentType(MediaType.APPLICATION_JSON)
                .content(passwordGrant("browser.rotate@example.com", "Str0ng!Pass")))
            .andExpect(status().isForbidden());

        MvcResult rotated = mockMvc.perform(post("/api/v1/auth/browser-sessions")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .header(BrowserSessionService.CSRF_HEADER_NAME, oldCsrf)
                .cookie(
                    new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, oldSession),
                    new Cookie(BrowserSessionService.CSRF_COOKIE_NAME, oldCsrf)
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(passwordGrant("browser.rotate@example.com", "Str0ng!Pass")))
            .andExpect(status().isOk())
            .andReturn();

        String newSession = cookieValue(cookieHeader(
            rotated.getResponse().getHeaders(HttpHeaders.SET_COOKIE),
            BrowserSessionService.SESSION_COOKIE_NAME
        ));
        assertThat(newSession).isNotEqualTo(oldSession);

        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, oldSession)))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, newSession)))
            .andExpect(status().isOk());
    }

    @Test
    void replacementFailureRollsBackNewSessionAndLeavesOldSessionActive() {
        User user = createVerifiedPatient("browser.atomic-rotate@example.com", "Str0ng!Pass");
        BrowserSessionService.IssuedBrowserSession existing = browserSessionService.issue(user.getId());
        long sessionCountBeforeRotation = browserSessionRepository.count();

        jdbcTemplate.execute("""
            CREATE OR REPLACE FUNCTION fail_browser_session_rotation()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF NEW.revoked_reason = 'SESSION_ROTATED' AND OLD.revoked_at IS NULL THEN
                    RAISE EXCEPTION 'forced browser session rotation failure';
                END IF;
                RETURN NEW;
            END;
            $$
            """);
        jdbcTemplate.execute("""
            CREATE TRIGGER browser_session_rotation_failure
            BEFORE UPDATE ON browser_sessions
            FOR EACH ROW
            EXECUTE FUNCTION fail_browser_session_rotation()
            """);

        try {
            assertThatThrownBy(() -> browserSessionService.issueReplacing(
                user.getId(),
                existing.rawSessionSecret()
            )).hasMessageContaining("forced browser session rotation failure");
        } finally {
            jdbcTemplate.execute("DROP TRIGGER IF EXISTS browser_session_rotation_failure ON browser_sessions");
            jdbcTemplate.execute("DROP FUNCTION IF EXISTS fail_browser_session_rotation()");
        }

        assertThat(browserSessionRepository.count()).isEqualTo(sessionCountBeforeRotation);
        assertThat(browserSessionRepository.findAllByUserId(user.getId()))
            .singleElement()
            .satisfies(session -> assertThat(session.getRevokedAt()).isNull());
        assertThat(browserSessionService.resolveAndTouch(existing.rawSessionSecret())).isPresent();
    }

    @Test
    void cookieMutationRequiresStoredCsrfAndAllowedOrigin() throws Exception {
        createVerifiedPatient("browser.csrf@example.com", "Str0ng!Pass");
        MvcResult login = createPasswordSession("browser.csrf@example.com", "Str0ng!Pass")
            .andExpect(status().isOk()).andReturn();
        String session = cookieValue(cookieHeader(login.getResponse().getHeaders(HttpHeaders.SET_COOKIE), BrowserSessionService.SESSION_COOKIE_NAME));
        String csrf = cookieValue(cookieHeader(login.getResponse().getHeaders(HttpHeaders.SET_COOKIE), BrowserSessionService.CSRF_COOKIE_NAME));

        mockMvc.perform(delete("/api/v1/auth/browser-sessions/current")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session)))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/auth/browser-sessions/current")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .header(BrowserSessionService.CSRF_HEADER_NAME, "wrong-csrf-secret-that-is-long-enough")
                .cookie(
                    new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session),
                    new Cookie(BrowserSessionService.CSRF_COOKIE_NAME, csrf)
                ))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/auth/browser-sessions/current")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", "https://evil.example")
                .header(BrowserSessionService.CSRF_HEADER_NAME, csrf)
                .cookie(
                    new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session),
                    new Cookie(BrowserSessionService.CSRF_COOKIE_NAME, csrf)
                ))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/auth/browser-sessions/current")
                .header("X-Healthcare-Bff-Token", BFF_TOKEN)
                .header("X-Healthcare-Original-Origin", ORIGIN)
                .header(BrowserSessionService.CSRF_HEADER_NAME, csrf)
                .cookie(
                    new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session),
                    new Cookie(BrowserSessionService.CSRF_COOKIE_NAME, csrf)
                ))
            .andExpect(status().isNoContent());

        assertThat(browserSessionRepository.findAll()).allMatch(value -> value.getRevokedAt() != null);
    }

    @Test
    void postgresIdleAndAbsoluteDeadlinesRejectWithoutJavaClockAuthority() throws Exception {
        User idleUser = createVerifiedPatient("browser.idle@example.com", "Str0ng!Pass");
        BrowserSessionService.IssuedBrowserSession idle = browserSessionService.issue(idleUser.getId());
        jdbcTemplate.update("""
            UPDATE browser_sessions
               SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 hours',
                   last_seen_at = CURRENT_TIMESTAMP - INTERVAL '2 hours',
                   idle_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour',
                   absolute_expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'
             WHERE session_secret_hash = ?
            """, BrowserSessionService.sha256(idle.rawSessionSecret()));

        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, idle.rawSessionSecret())))
            .andExpect(status().isUnauthorized());

        User absoluteUser = createVerifiedPatient("browser.absolute@example.com", "Str0ng!Pass");
        BrowserSessionService.IssuedBrowserSession absolute = browserSessionService.issue(absoluteUser.getId());
        jdbcTemplate.update("""
            UPDATE browser_sessions
               SET created_at = CURRENT_TIMESTAMP - INTERVAL '13 hours',
                   last_seen_at = CURRENT_TIMESTAMP - INTERVAL '13 hours',
                   idle_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour',
                   absolute_expires_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes'
             WHERE session_secret_hash = ?
            """, BrowserSessionService.sha256(absolute.rawSessionSecret()));

        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, absolute.rawSessionSecret())))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void passwordResetRevokesBrowserSessionsAsWellAsRefreshTokens() throws Exception {
        User user = createVerifiedPatient("browser.reset@example.com", "Str0ng!Pass");
        BrowserSessionService.IssuedBrowserSession session = browserSessionService.issue(user.getId());

        mockMvc.perform(post("/api/v1/auth/password-reset-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"browser.reset@example.com\"}"))
            .andExpect(status().isAccepted());
        String otp = otpFromEmail();

        mockMvc.perform(post("/api/v1/auth/password-reset-requests/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"browser.reset@example.com\",\"otp\":\"%s\",\"newPassword\":\"N3w!Password\"}".formatted(otp)))
            .andExpect(status().isNoContent());

        assertThat(browserSessionRepository.findAllByUserId(user.getId()))
            .allMatch(value -> value.getRevokedAt() != null);
        mockMvc.perform(get("/api/v1/users/me")
                .cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, session.rawSessionSecret())))
            .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions createPasswordSession(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/browser-sessions")
            .header("X-Healthcare-Bff-Token", BFF_TOKEN)
            .header("X-Healthcare-Original-Origin", ORIGIN)
            .contentType(MediaType.APPLICATION_JSON)
            .content(passwordGrant(email, password)));
    }

    private String passwordGrant(String email, String password) {
        return """
            {"grantType":"PASSWORD","email":"%s","password":"%s"}
            """.formatted(email, password);
    }

    private User createVerifiedPatient(String email, String password) {
        Role role = roleRepository.findByCode("PATIENT").orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName("Browser Session Patient");
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

    private String cookieHeader(List<String> headers, String name) {
        return headers.stream()
            .filter(value -> value.startsWith(name + "="))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Missing Set-Cookie for " + name));
    }

    private String cookieValue(String header) {
        int start = header.indexOf('=') + 1;
        int end = header.indexOf(';', start);
        return header.substring(start, end < 0 ? header.length() : end);
    }

    private String otpFromEmail() {
        Matcher matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(deliveredEmailBody.get());
        if (!matcher.find()) throw new AssertionError("Reset email did not contain a six-digit OTP");
        return matcher.group(1);
    }

    private record RequestFixture(String path, String body) {
    }
}
