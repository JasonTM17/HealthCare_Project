package com.healthcare.auth.service;

import com.healthcare.auth.GoogleAuthProperties;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Header;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Locator;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifies Google Identity Services ID tokens (RS256 JWTs) against Google's
 * published JWKS. Signing keys are cached with a bounded TTL so a login burst
 * does not hit Google per request; an unknown {@code kid} forces exactly one
 * refresh (key rotation) before the token is rejected.
 *
 * <p>Every failure path maps to a stable {@link BusinessException}; raw Google
 * or JWKS errors never reach the client.
 */
@Service
public class GoogleIdTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifier.class);

    private static final List<String> ALLOWED_ISSUERS =
        List.of("accounts.google.com", "https://accounts.google.com");
    private static final Duration JWKS_TTL = Duration.ofHours(6);
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(1);

    private final GoogleAuthProperties properties;
    private final RestTemplate restTemplate;

    private final Map<String, Key> keyCache = new ConcurrentHashMap<>();
    private volatile Instant cacheExpiresAt = Instant.MIN;

    @Autowired
    public GoogleIdTokenVerifier(GoogleAuthProperties properties,
                                 RestTemplateBuilder restTemplateBuilder) {
        this.properties = properties;
        this.restTemplate = restTemplateBuilder
            .connectTimeout(Duration.ofSeconds(3))
            .readTimeout(Duration.ofSeconds(5))
            .build();
    }

    /** Visible for tests — bypasses the RestTemplateBuilder timeouts. */
    GoogleIdTokenVerifier(GoogleAuthProperties properties, RestTemplate restTemplate) {
        this.properties = properties;
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    public record GoogleIdentity(String subject, String email, String displayName) {}

    /**
     * Verifies a GIS credential and returns the identity it attests.
     *
     * @throws BusinessException 503 when the feature is not configured or
     *         Google keys cannot be fetched; 401 when the token itself is
     *         invalid, expired, mis-addressed or for an unverified email.
     */
    public GoogleIdentity verify(String idToken) {
        if (!isConfigured()) {
            throw new BusinessException(
                503,
                ErrorCodes.GOOGLE_SIGN_IN_UNAVAILABLE,
                "Đăng nhập Google chưa được bật trên hệ thống"
            );
        }
        final Claims claims;
        try {
            claims = Jwts.parser()
                .keyLocator(new GoogleKeyLocator())
                .clockSkewSeconds(CLOCK_SKEW.getSeconds())
                .build()
                .parseSignedClaims(idToken)
                .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw invalidToken();
        }

        String issuer = claims.getIssuer();
        if (issuer == null || !ALLOWED_ISSUERS.contains(issuer)) {
            throw invalidToken();
        }
        if (claims.getAudience() == null || !claims.getAudience().contains(properties.getClientId())) {
            throw invalidToken();
        }
        String email = claims.get("email", String.class);
        Object emailVerified = claims.get("email_verified");
        boolean verified = emailVerified instanceof Boolean b
            ? b
            : "true".equalsIgnoreCase(String.valueOf(emailVerified));
        if (email == null || email.isBlank() || !verified) {
            throw invalidToken();
        }
        String displayName = claims.get("name", String.class);
        return new GoogleIdentity(claims.getSubject(), email.trim().toLowerCase(), displayName);
    }

    private BusinessException invalidToken() {
        return new BusinessException(
            401,
            ErrorCodes.AUTHENTICATION_REQUIRED,
            "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn"
        );
    }

    /**
     * Resolves the RSA public key for the token's {@code kid}. One cache miss
     * triggers a single JWKS refresh (Google rotates keys); a second miss
     * rejects the token.
     */
    private final class GoogleKeyLocator implements Locator<Key> {
        @Override
        public Key locate(Header header) {
            Object kidValue = header == null ? null : header.get("kid");
            String kid = kidValue == null ? null : String.valueOf(kidValue);
            if (kid == null || kid.isBlank()) {
                throw invalidToken();
            }
            Key cached = keyCache.get(kid);
            if (cached != null && Instant.now().isBefore(cacheExpiresAt)) {
                return cached;
            }
            refreshKeys();
            Key key = keyCache.get(kid);
            if (key == null) {
                throw invalidToken();
            }
            return key;
        }
    }

    private synchronized void refreshKeys() {
        if (Instant.now().isBefore(cacheExpiresAt)) {
            return;
        }
        final String jwksJson;
        try {
            ResponseEntity<String> response =
                restTemplate.getForEntity(properties.getJwksUrl(), String.class);
            jwksJson = response.getBody();
        } catch (RestClientException e) {
            log.warn("Google JWKS fetch failed: {}", e.getClass().getSimpleName());
            throw new BusinessException(
                503,
                ErrorCodes.GOOGLE_SIGN_IN_UNAVAILABLE,
                "Đăng nhập Google tạm thời không khả dụng"
            );
        }
        try {
            JwkSet jwkSet = Jwks.setParser().build().parse(jwksJson);
            Map<String, Key> fresh = new ConcurrentHashMap<>();
            for (Jwk<?> jwk : jwkSet) {
                if (jwk.getId() != null && jwk.toKey() instanceof Key key) {
                    fresh.put(jwk.getId(), key);
                }
            }
            keyCache.clear();
            keyCache.putAll(fresh);
            cacheExpiresAt = Instant.now().plus(JWKS_TTL);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Google JWKS parse failed: {}", e.getClass().getSimpleName());
            throw new BusinessException(
                503,
                ErrorCodes.GOOGLE_SIGN_IN_UNAVAILABLE,
                "Đăng nhập Google tạm thời không khả dụng"
            );
        }
    }
}
