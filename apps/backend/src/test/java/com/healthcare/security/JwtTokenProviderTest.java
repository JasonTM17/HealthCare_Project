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
    void rejectsUnsafeTokenTtls() {
        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 0, 604800)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT token TTLs must be positive");

        assertThatThrownBy(() -> new JwtTokenProvider(new JwtProperties(VALID_SECRET, 900, 899)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("JWT refresh token TTL must not be shorter than access token TTL");
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
}
