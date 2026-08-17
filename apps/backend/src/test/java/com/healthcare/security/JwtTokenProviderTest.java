package com.healthcare.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {

    private static final String VALID_SECRET = "test-secret-key-healthcare-project-must-be-32chars";

    @Test
    void rejectsKnownLocalDefaultSecret() {
        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(
            "local-development-secret-must-be-replaced-before-production",
            900,
            604800
        )))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT_SECRET must be replaced with a unique secret");
    }

    @Test
    void rejectsKnownExampleSecret() {
        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(
            "change-me-use-a-256-bit-secret-key-for-production-environment-please",
            900,
            604800
        )))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT_SECRET must be replaced with a unique secret");
    }

    @Test
    void rejectsLowEntropySecrets() {
        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(
            "A".repeat(32),
            900,
            604800
        )))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT_SECRET must not be an obvious low-entropy or repeated value");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(
            "abcd".repeat(8),
            900,
            604800
        )))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT_SECRET must not be an obvious low-entropy or repeated value");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(
            "abcdefgh".repeat(4),
            900,
            604800
        )))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT_SECRET must not be an obvious low-entropy or repeated value");
    }

    @Test
    void rejectsUnsafeTokenTtls() {
        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 0, 604800)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT token TTLs must be positive");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 900, 899)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT refresh token TTL must not be shorter than access token TTL");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 3_601, 604800)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT access token TTL must not exceed 3600 seconds");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 900, 2_592_001)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT refresh token TTL must not exceed 2592000 seconds");
    }

    @Test
    void rejectsSignedTokensWithInvalidStructure() {
        JwtTokenProvider provider = provider();
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(VALID_SECRET.getBytes(StandardCharsets.UTF_8));
        String malformedToken = Jwts.builder()
            .subject("not-a-uuid")
            .claim(JwtTokenProvider.CLAIM_TYPE, JwtTokenProvider.TOKEN_TYPE_REFRESH)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(900)))
            .signWith(key)
            .compact();

        assertThat(provider.isValid(malformedToken)).isFalse();
        assertThat(provider.isRefreshToken(malformedToken)).isFalse();
    }

    @Test
    void rejectsTokenSignedWithWrongKey() {
        JwtTokenProvider provider = provider();
        Instant now = Instant.now();
        SecretKey wrongKey = Keys.hmacShaKeyFor(
            "different-signing-key-healthcare-project-must-be-32chars".getBytes(StandardCharsets.UTF_8)
        );
        String token = signedToken(
            wrongKey,
            JwtTokenProvider.TOKEN_TYPE_ACCESS,
            UUID.randomUUID(),
            now,
            now.plusSeconds(900),
            "patient@example.com"
        );

        assertThat(provider.isValid(token)).isFalse();
        assertThat(provider.isAccessToken(token)).isFalse();
    }

    @Test
    void rejectsTamperedToken() {
        JwtTokenProvider provider = provider();
        String token = provider.generateAccessToken(UUID.randomUUID(), "patient@example.com");
        String tamperedToken = token.substring(0, token.length() - 1)
            + (token.endsWith("A") ? "B" : "A");

        assertThat(provider.isValid(tamperedToken)).isFalse();
    }

    @Test
    void rejectsExpiredToken() {
        JwtTokenProvider provider = provider();
        Instant now = Instant.now();
        String token = signedToken(
            signingKey(VALID_SECRET),
            JwtTokenProvider.TOKEN_TYPE_ACCESS,
            UUID.randomUUID(),
            now.minusSeconds(900),
            now.minusSeconds(1),
            "patient@example.com"
        );

        assertThat(provider.isValid(token)).isFalse();
        assertThat(provider.isAccessToken(token)).isFalse();
    }

    @Test
    void rejectsAccessTokenWithoutEmail() {
        JwtTokenProvider provider = provider();
        Instant now = Instant.now();
        String token = signedToken(
            signingKey(VALID_SECRET),
            JwtTokenProvider.TOKEN_TYPE_ACCESS,
            UUID.randomUUID(),
            now,
            now.plusSeconds(900),
            null
        );

        assertThat(provider.isValid(token)).isFalse();
        assertThat(provider.isAccessToken(token)).isFalse();
    }

    @Test
    void rejectsFutureIssuedAt() {
        JwtTokenProvider provider = provider();
        Instant issuedAt = Instant.now().plusSeconds(3_600);
        String token = signedToken(
            signingKey(VALID_SECRET),
            JwtTokenProvider.TOKEN_TYPE_ACCESS,
            UUID.randomUUID(),
            issuedAt,
            issuedAt.plusSeconds(900),
            "patient@example.com"
        );

        assertThat(provider.isValid(token)).isFalse();
    }

    @Test
    void rejectsInvalidIssuedAtAndClaimStructure() {
        JwtTokenProvider provider = provider();
        Instant now = Instant.now();
        SecretKey key = signingKey(VALID_SECRET);

        String missingIssuedAt = Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .claim(JwtTokenProvider.CLAIM_TYPE, JwtTokenProvider.TOKEN_TYPE_REFRESH)
            .id(UUID.randomUUID().toString())
            .expiration(Date.from(now.plusSeconds(900)))
            .signWith(key)
            .compact();

        String wrongType = Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .claim(JwtTokenProvider.CLAIM_TYPE, "admin")
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(900)))
            .signWith(key)
            .compact();

        String expirationBeforeIssuedAt = signedToken(
            key,
            JwtTokenProvider.TOKEN_TYPE_REFRESH,
            UUID.randomUUID(),
            now,
            now.minusSeconds(1),
            null
        );

        assertThat(provider.isValid(missingIssuedAt)).isFalse();
        assertThat(provider.isValid(wrongType)).isFalse();
        assertThat(provider.isValid(expirationBeforeIssuedAt)).isFalse();
    }

    @Test
    void acceptsGeneratedAccessAndRefreshTokens() {
        JwtTokenProvider provider = provider();
        UUID userId = UUID.randomUUID();

        String accessToken = provider.generateAccessToken(userId, "patient@example.com");
        String refreshToken = provider.generateRefreshToken(userId);

        assertThat(provider.isValid(accessToken)).isTrue();
        assertThat(provider.isAccessToken(accessToken)).isTrue();
        assertThat(provider.isValid(refreshToken)).isTrue();
        assertThat(provider.isRefreshToken(refreshToken)).isTrue();
    }

    private JwtTokenProvider provider() {
        return new JwtTokenProvider(new JwtProperties(VALID_SECRET, 900, 604800));
    }

    private SecretKey signingKey(String secret) {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    private String signedToken(
            SecretKey key,
            String tokenType,
            UUID userId,
            Instant issuedAt,
            Instant expiration,
            String email) {
        var builder = Jwts.builder()
            .subject(userId.toString())
            .claim(JwtTokenProvider.CLAIM_TYPE, tokenType)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(issuedAt))
            .expiration(Date.from(expiration));
        if (email != null) {
            builder.claim("email", email);
        }
        return builder.signWith(key).compact();
    }
}
