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

    private static final long MAX_ACCESS_TOKEN_TTL_SECONDS = 3_600;
    private static final long MAX_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
    private static final long MAX_FUTURE_ISSUED_AT_SKEW_SECONDS = 30;
    private static final int MIN_DISTINCT_SECRET_CODE_POINTS = 8;
    private static final int MAX_REPEATED_SECRET_PATTERN_CODE_POINTS = 8;

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
        if (isObviouslyLowEntropy(secret)) {
            throw new IllegalStateException("JWT_SECRET must not be an obvious low-entropy or repeated value");
        }
        if (properties.accessTokenTtl() <= 0 || properties.refreshTokenTtl() <= 0) {
            throw new IllegalStateException("JWT token TTLs must be positive");
        }
        if (properties.accessTokenTtl() > MAX_ACCESS_TOKEN_TTL_SECONDS) {
            throw new IllegalStateException("JWT access token TTL must not exceed 3600 seconds");
        }
        if (properties.refreshTokenTtl() > MAX_REFRESH_TOKEN_TTL_SECONDS) {
            throw new IllegalStateException("JWT refresh token TTL must not exceed 2592000 seconds");
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
        String subject;
        String tokenId;
        String tokenType;
        Date issuedAt;
        Date expiration;
        String email = null;

        try {
            subject = claims.getSubject();
            tokenId = claims.getId();
            tokenType = claims.get(CLAIM_TYPE, String.class);
            issuedAt = claims.getIssuedAt();
            expiration = claims.getExpiration();
            if (TOKEN_TYPE_ACCESS.equals(tokenType)) {
                email = claims.get("email", String.class);
            }
        } catch (RuntimeException e) {
            return false;
        }

        if (!hasText(subject)
                || !hasText(tokenId)
                || issuedAt == null
                || expiration == null
                || (!TOKEN_TYPE_ACCESS.equals(tokenType) && !TOKEN_TYPE_REFRESH.equals(tokenType))
                || (TOKEN_TYPE_ACCESS.equals(tokenType) && !hasText(email))) {
            return false;
        }

        try {
            UUID parsedSubject = UUID.fromString(subject);
            if (!parsedSubject.toString().equalsIgnoreCase(subject)) {
                return false;
            }
        } catch (IllegalArgumentException e) {
            return false;
        }

        Instant issuedAtInstant = issuedAt.toInstant();
        Instant expirationInstant = expiration.toInstant();
        Instant now = Instant.now();
        if (issuedAtInstant.isAfter(now.plusSeconds(MAX_FUTURE_ISSUED_AT_SKEW_SECONDS))
                || !expirationInstant.isAfter(issuedAtInstant)) {
            return false;
        }

        long maxTokenLifetime = TOKEN_TYPE_ACCESS.equals(tokenType)
            ? MAX_ACCESS_TOKEN_TTL_SECONDS
            : MAX_REFRESH_TOKEN_TTL_SECONDS;
        return !expirationInstant.isAfter(issuedAtInstant.plusSeconds(maxTokenLifetime));
    }

    private boolean isObviouslyLowEntropy(String secret) {
        int[] codePoints = secret.codePoints().toArray();
        if (secret.codePoints().distinct().count() < MIN_DISTINCT_SECRET_CODE_POINTS) {
            return true;
        }

        for (int patternLength = 1;
             patternLength <= MAX_REPEATED_SECRET_PATTERN_CODE_POINTS && patternLength < codePoints.length;
             patternLength++) {
            if (codePoints.length % patternLength != 0) {
                continue;
            }

            boolean repeated = true;
            for (int index = patternLength; index < codePoints.length; index++) {
                if (codePoints[index] != codePoints[index % patternLength]) {
                    repeated = false;
                    break;
                }
            }
            if (repeated) {
                return true;
            }
        }
        return false;
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
