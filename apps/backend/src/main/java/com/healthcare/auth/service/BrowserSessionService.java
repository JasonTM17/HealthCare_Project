package com.healthcare.auth.service;

import com.healthcare.auth.dto.BrowserSessionResponse;
import com.healthcare.auth.security.BrowserSessionContext;
import com.healthcare.user.dto.AuthResponse;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class BrowserSessionService {

    public static final String SESSION_COOKIE_NAME = "__Host-healthcare_session";
    public static final String CSRF_COOKIE_NAME = "__Host-healthcare_csrf";
    public static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    public static final String REQUEST_CONTEXT_ATTRIBUTE =
        BrowserSessionService.class.getName() + ".context";

    private static final Duration ABSOLUTE_TTL = Duration.ofHours(12);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;

    public BrowserSessionService(JdbcTemplate jdbcTemplate, UserRepository userRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
    }

    @Transactional
    public IssuedBrowserSession issue(UUID userId) {
        return issueInternal(userId);
    }

    /**
     * Creates a fresh browser session and revokes an ambient session in one
     * database transaction. A database failure while revoking the replaced
     * session therefore cannot leave a newly issued session committed beside
     * the still-active old session.
     */
    @Transactional
    public IssuedBrowserSession issueReplacing(UUID userId, String replacedRawSessionSecret) {
        IssuedBrowserSession issued = issueInternal(userId);
        if (isPlausibleSecret(replacedRawSessionSecret)) {
            revokeByHash(
                sha256(replacedRawSessionSecret),
                normalizeReason("SESSION_ROTATED")
            );
        }
        return issued;
    }

    private IssuedBrowserSession issueInternal(UUID userId) {
        for (int attempt = 0; attempt < 2; attempt++) {
            String rawSessionSecret = randomSecret();
            String rawCsrfSecret = randomSecret();
            try {
                BrowserSessionContext context = jdbcTemplate.queryForObject("""
                    INSERT INTO browser_sessions (
                        user_id, session_secret_hash, csrf_secret_hash,
                        created_at, last_seen_at, idle_expires_at, absolute_expires_at
                    )
                    VALUES (
                        ?, ?, ?,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP + INTERVAL '30 minutes',
                        CURRENT_TIMESTAMP + INTERVAL '12 hours'
                    )
                    RETURNING id, user_id, csrf_secret_hash, idle_expires_at, absolute_expires_at
                    """,
                    (rs, rowNum) -> new BrowserSessionContext(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getString("csrf_secret_hash"),
                        rs.getObject("idle_expires_at", OffsetDateTime.class),
                        rs.getObject("absolute_expires_at", OffsetDateTime.class)
                    ),
                    userId,
                    sha256(rawSessionSecret),
                    sha256(rawCsrfSecret)
                );
                if (context == null) {
                    throw new IllegalStateException("Browser session insert did not return a row");
                }
                return new IssuedBrowserSession(
                    rawSessionSecret,
                    rawCsrfSecret,
                    responseFor(context)
                );
            } catch (DataIntegrityViolationException collision) {
                if (attempt == 1) throw collision;
            }
        }
        throw new IllegalStateException("Unable to create browser session");
    }

    /**
     * Atomically accepts and extends an active session using PostgreSQL time.
     * The idle deadline is capped by the immutable absolute deadline.
     */
    @Transactional
    public Optional<ResolvedBrowserSession> resolveAndTouch(String rawSessionSecret) {
        if (!isPlausibleSecret(rawSessionSecret)) return Optional.empty();

        List<BrowserSessionContext> rows = jdbcTemplate.query("""
            UPDATE browser_sessions
               SET last_seen_at = CURRENT_TIMESTAMP,
                   idle_expires_at = LEAST(
                       CURRENT_TIMESTAMP + INTERVAL '30 minutes',
                       absolute_expires_at
                   )
             WHERE session_secret_hash = ?
               AND revoked_at IS NULL
               AND idle_expires_at > CURRENT_TIMESTAMP
               AND absolute_expires_at > CURRENT_TIMESTAMP
            RETURNING id, user_id, csrf_secret_hash, idle_expires_at, absolute_expires_at
            """,
            (rs, rowNum) -> new BrowserSessionContext(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("csrf_secret_hash"),
                rs.getObject("idle_expires_at", OffsetDateTime.class),
                rs.getObject("absolute_expires_at", OffsetDateTime.class)
            ),
            sha256(rawSessionSecret)
        );
        if (rows.size() != 1) return Optional.empty();

        BrowserSessionContext context = rows.getFirst();
        User user = userRepository.findWithRolesById(context.userId()).orElse(null);
        if (user == null || !"ACTIVE".equals(user.getStatus()) || !user.isEmailVerified()) {
            revokeByHash(sha256(rawSessionSecret), "ACCOUNT_INELIGIBLE");
            return Optional.empty();
        }
        return Optional.of(new ResolvedBrowserSession(context, user));
    }

    @Transactional(readOnly = true)
    public BrowserSessionResponse responseFor(BrowserSessionContext context) {
        User user = userRepository.findWithRolesById(context.userId())
            .orElseThrow(() -> new IllegalStateException("Browser session owner no longer exists"));
        return toResponse(user, context);
    }

    @Transactional
    public void revokeRaw(String rawSessionSecret, String reason) {
        if (!isPlausibleSecret(rawSessionSecret)) return;
        revokeByHash(sha256(rawSessionSecret), normalizeReason(reason));
    }

    @Transactional
    public void revokeAllForUser(UUID userId, String reason) {
        jdbcTemplate.update("""
            UPDATE browser_sessions
               SET revoked_at = CURRENT_TIMESTAMP,
                   revoked_reason = ?
             WHERE user_id = ?
               AND revoked_at IS NULL
            """, normalizeReason(reason), userId);
    }

    public boolean csrfMatches(BrowserSessionContext context, String rawCsrfSecret) {
        if (context == null || !isPlausibleSecret(rawCsrfSecret)) return false;
        return constantTimeEquals(
            context.csrfSecretHash().getBytes(StandardCharsets.US_ASCII),
            sha256(rawCsrfSecret).getBytes(StandardCharsets.US_ASCII)
        );
    }

    public Optional<BrowserSessionContext> context(HttpServletRequest request) {
        Object value = request.getAttribute(REQUEST_CONTEXT_ATTRIBUTE);
        return value instanceof BrowserSessionContext context
            ? Optional.of(context)
            : Optional.empty();
    }

    public String cookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    public void writeIssuedCookies(HttpServletResponse response, IssuedBrowserSession issued) {
        response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie(issued.rawSessionSecret()).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, csrfCookie(issued.rawCsrfSecret()).toString());
    }

    public void clearCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie(SESSION_COOKIE_NAME, true).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie(CSRF_COOKIE_NAME, false).toString());
    }

    private BrowserSessionResponse responseFor(BrowserSessionContext context, User user) {
        return toResponse(user, context);
    }

    private BrowserSessionResponse toResponse(User user, BrowserSessionContext context) {
        List<String> roles = user.getRoles().stream().map(Role::getCode).sorted().toList();
        return new BrowserSessionResponse(
            new AuthResponse.UserInfo(
                user.getId().toString(),
                user.getEmail(),
                user.getDisplayName(),
                roles,
                user.isEmailVerified()
            ),
            context.idleExpiresAt(),
            context.absoluteExpiresAt()
        );
    }

    private void revokeByHash(String sessionHash, String reason) {
        jdbcTemplate.update("""
            UPDATE browser_sessions
               SET revoked_at = CURRENT_TIMESTAMP,
                   revoked_reason = ?
             WHERE session_secret_hash = ?
               AND revoked_at IS NULL
            """, reason, sessionHash);
    }

    private ResponseCookie sessionCookie(String value) {
        return ResponseCookie.from(SESSION_COOKIE_NAME, value)
            .secure(true)
            .httpOnly(true)
            .sameSite("Lax")
            .path("/")
            .maxAge(ABSOLUTE_TTL)
            .build();
    }

    private ResponseCookie csrfCookie(String value) {
        return ResponseCookie.from(CSRF_COOKIE_NAME, value)
            .secure(true)
            .httpOnly(false)
            .sameSite("Lax")
            .path("/")
            .maxAge(ABSOLUTE_TTL)
            .build();
    }

    private ResponseCookie expiredCookie(String name, boolean httpOnly) {
        return ResponseCookie.from(name, "")
            .secure(true)
            .httpOnly(httpOnly)
            .sameSite("Lax")
            .path("/")
            .maxAge(Duration.ZERO)
            .build();
    }

    private String randomSecret() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private boolean isPlausibleSecret(String value) {
        return value != null && value.length() >= 32 && value.length() <= 128;
    }

    private String normalizeReason(String value) {
        if (value == null || value.isBlank()) return "REVOKED";
        String normalized = value.trim().toUpperCase().replaceAll("[^A-Z0-9_:-]", "_");
        return normalized.substring(0, Math.min(64, normalized.length()));
    }

    private boolean constantTimeEquals(byte[] expected, byte[] actual) {
        return MessageDigest.isEqual(expected, actual);
    }

    public record IssuedBrowserSession(
        String rawSessionSecret,
        String rawCsrfSecret,
        BrowserSessionResponse response
    ) {
    }

    public record ResolvedBrowserSession(BrowserSessionContext context, User user) {
    }
}
