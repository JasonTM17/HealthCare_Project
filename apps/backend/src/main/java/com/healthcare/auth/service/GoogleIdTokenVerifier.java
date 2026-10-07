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
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Locale;
import java.util.regex.Pattern;

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

    private record KeySnapshot(Map<String, Key> keys, Instant expiresAt) {}
    private volatile KeySnapshot cache = new KeySnapshot(Map.of(), Instant.MIN);
    private Instant lastForcedRefreshAt = Instant.MIN;
    private static final Duration ROTATION_COOLDOWN = Duration.ofSeconds(30);
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@\\p{Cntrl}]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,63}$");
    private static final Pattern DOMAIN = Pattern.compile("^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,63}$");

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

    public record GoogleIdentity(String subject, String email, String displayName, boolean authoritativeEmail) {
        public GoogleIdentity(String subject, String email, String displayName) {
            this(subject, email, displayName, email != null && email.endsWith("@gmail.com"));
        }
    }

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
        if (idToken == null || idToken.isBlank() || idToken.length() > 8192) throw invalidToken();
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

        try {
        String issuer = claims.getIssuer();
        if (issuer == null || !ALLOWED_ISSUERS.contains(issuer)) {
            throw invalidToken();
        }
        if (claims.getAudience() == null || !claims.getAudience().contains(properties.getClientId())) {
            throw invalidToken();
        }
        if (claims.getExpiration() == null || !(claims.get("sub") instanceof String subject)
            || subject.isBlank() || subject.length() > 255 || subject.chars().anyMatch(Character::isISOControl)
            || !(claims.get("email") instanceof String rawEmail)
            || !Boolean.TRUE.equals(claims.get("email_verified"))) {
            throw invalidToken();
        }
        String email = rawEmail.toLowerCase(Locale.ROOT);
        if (email.length() > 320 || !EMAIL.matcher(email).matches()) throw invalidToken();
        Object name = claims.get("name");
        if (name != null && !(name instanceof String)) throw invalidToken();
        String displayName = name == null ? null : ((String) name).trim();
        if (displayName != null && (displayName.length() > 160
            || displayName.chars().anyMatch(Character::isISOControl))) throw invalidToken();
        Object hostedDomain = claims.get("hd");
        if (hostedDomain != null && (!(hostedDomain instanceof String hd)
            || hd.length() > 253 || !DOMAIN.matcher(hd).matches())) throw invalidToken();
        return new GoogleIdentity(subject, email, displayName,
            email.endsWith("@gmail.com") || hostedDomain != null);
        } catch (JwtException | IllegalArgumentException e) {
            throw invalidToken();
        }
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
            if (header == null || !"RS256".equals(header.get("alg"))
                || !(kidValue instanceof String kid) || kid.isBlank() || kid.length() > 255) {
                throw invalidToken();
            }
            KeySnapshot snapshot = cache;
            Key cachedKey = snapshot.keys().get(kid);
            if (cachedKey != null && Instant.now().isBefore(snapshot.expiresAt())) {
                return cachedKey;
            }
            refreshKeys(kid);
            Key key = cache.keys().get(kid);
            if (key == null) {
                throw invalidToken();
            }
            return key;
        }
    }

    private synchronized void refreshKeys(String requestedKid) {
        Instant now = Instant.now();
        KeySnapshot snapshot = cache;
        if (now.isBefore(snapshot.expiresAt())) {
            if (snapshot.keys().containsKey(requestedKid)) return;
            if (now.isBefore(lastForcedRefreshAt.plus(ROTATION_COOLDOWN))) throw invalidToken();
            lastForcedRefreshAt = now;
        }
        final String jwksJson;
        final long cacheMaxAge;
        try {
            ResponseEntity<String> response =
                restTemplate.getForEntity(properties.getJwksUrl(), String.class);
            jwksJson = response.getBody();
            long age = response.getHeaders().getCacheControl() == null ? -1 :
                java.util.Arrays.stream(response.getHeaders().getCacheControl().split(","))
                    .map(String::trim).filter(value -> value.matches("max-age=\\d{1,9}"))
                    .mapToLong(value -> Long.parseLong(value.substring(8))).findFirst().orElse(-1);
            cacheMaxAge = age < 0 ? JWKS_TTL.getSeconds() : Math.min(age, Duration.ofDays(1).getSeconds());
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
            Map<String, Key> fresh = new HashMap<>();
            for (Jwk<?> jwk : jwkSet) {
                if (jwk.getId() != null && jwk.toKey() instanceof RSAPublicKey key
                    && key.getModulus().bitLength() >= 2048
                    && (jwk.get("alg") == null || "RS256".equals(jwk.get("alg")))
                    && (jwk.get("use") == null || "sig".equals(jwk.get("use")))) {
                    fresh.put(jwk.getId(), key);
                }
            }
            if (fresh.isEmpty()) throw new IllegalArgumentException("No signing keys");
            cache = new KeySnapshot(Map.copyOf(fresh), Instant.now().plusSeconds(cacheMaxAge));
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
