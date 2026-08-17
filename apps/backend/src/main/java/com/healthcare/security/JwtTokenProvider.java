package com.healthcare.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Set;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";
    public static final String CLAIM_TYPE = "type";
    private static final Set<String> UNSAFE_DEFAULT_SECRETS = Set.of(
        "local-development-secret-must-be-replaced-before-production",
        "change-me-use-a-256-bit-secret-key-for-production-environment-please"
    );

    private final JwtProperties properties;
    private final SecretKey signingKey;

    public JwtTokenProvider(JwtProperties properties) {
        this.properties = properties;
        String secret = properties.secret();
        if (secret == null || secret.isBlank() || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes");
        }
        if (UNSAFE_DEFAULT_SECRETS.contains(secret.trim())) {
            throw new IllegalStateException("JWT_SECRET must be replaced with a unique secret");
        }
        if (properties.accessTokenTtl() <= 0 || properties.refreshTokenTtl() <= 0) {
            throw new IllegalStateException("JWT token TTLs must be positive");
        }
        if (properties.refreshTokenTtl() < properties.accessTokenTtl()) {
            throw new IllegalStateException("JWT refresh token TTL must not be shorter than access token TTL");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        Instant expiry = now.plus(properties.accessTokenTtl(), ChronoUnit.SECONDS);

        return Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
            .claim(CLAIM_TYPE, TOKEN_TYPE_ACCESS)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiry))
            .signWith(signingKey)
            .compact();
    }

    public String generateRefreshToken(UUID userId) {
        Instant now = Instant.now();
        Instant expiry = now.plus(properties.refreshTokenTtl(), ChronoUnit.SECONDS);

        return Jwts.builder()
            .subject(userId.toString())
            .claim(CLAIM_TYPE, TOKEN_TYPE_REFRESH)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiry))
            .signWith(signingKey)
            .compact();
    }

    public boolean isAccessToken(String token) {
        try {
            Claims claims = parseClaims(token);
            return hasRequiredClaims(claims)
                && TOKEN_TYPE_ACCESS.equals(claims.get(CLAIM_TYPE, String.class))
                && hasText(claims.get("email", String.class));
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isRefreshToken(String token) {
        try {
            Claims claims = parseClaims(token);
            return hasRequiredClaims(claims)
                && TOKEN_TYPE_REFRESH.equals(claims.get(CLAIM_TYPE, String.class));
        } catch (Exception e) {
            return false;
        }
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isValid(String token) {
        try {
            return hasRequiredClaims(parseClaims(token));
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasRequiredClaims(Claims claims) {
        if (!hasText(claims.getSubject())
                || !hasText(claims.getId())
                || claims.getIssuedAt() == null
                || claims.getExpiration() == null) {
            return false;
        }

        try {
            UUID.fromString(claims.getSubject());
        } catch (IllegalArgumentException e) {
            return false;
        }

        String tokenType = claims.get(CLAIM_TYPE, String.class);
        return TOKEN_TYPE_ACCESS.equals(tokenType) || TOKEN_TYPE_REFRESH.equals(tokenType);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public String extractEmail(String token) {
        return parseClaims(token).get("email", String.class);
    }

    public Instant extractExpiry(String token) {
        return parseClaims(token).getExpiration().toInstant();
    }
}
