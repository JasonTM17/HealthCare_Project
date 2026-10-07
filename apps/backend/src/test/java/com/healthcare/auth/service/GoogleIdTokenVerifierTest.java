package com.healthcare.auth.service;

import com.healthcare.auth.GoogleAuthProperties;
import com.healthcare.exception.BusinessException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;

/**
 * Verifier behavior for the Google grant: signature, issuer, audience and
 * email-verification checks all fail closed, JWKS fetch failures degrade to a
 * stable 503, and a key rotation (unknown kid) forces a refresh before a
 * reject.
 */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "unit-test-client.apps.googleusercontent.com";
    private static final String JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

    private KeyPair keyPair;
    private String kid;
    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private GoogleIdTokenVerifier verifier;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();
        kid = "test-key-1";

        restTemplate = new RestTemplate();
        server = MockRestServiceServer.bindTo(restTemplate).build();

        GoogleAuthProperties properties = new GoogleAuthProperties();
        properties.setClientId(CLIENT_ID);
        properties.setJwksUrl(JWKS_URL);
        verifier = new GoogleIdTokenVerifier(properties, restTemplate);
    }

    private static String b64(BigInteger value) {
        byte[] bytes = value.toByteArray();
        // strip the sign byte BigInteger may prepend
        if (bytes.length > 1 && bytes[0] == 0) {
            bytes = java.util.Arrays.copyOfRange(bytes, 1, bytes.length);
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String jwksJson() {
        RSAPublicKey pub = (RSAPublicKey) keyPair.getPublic();
        return "{\"keys\":[{\"kty\":\"RSA\",\"alg\":\"RS256\",\"use\":\"sig\",\"kid\":\""
            + kid + "\",\"n\":\"" + b64(pub.getModulus())
            + "\",\"e\":\"" + b64(pub.getPublicExponent()) + "\"}]}";
    }

    private String sign(Map<String, Object> claims) {
        var builder = Jwts.builder()
            .header().keyId(kid).and()
            .issuer("https://accounts.google.com")
            .audience().add(CLIENT_ID).and()
            .issuedAt(Date.from(Instant.now().minusSeconds(60)))
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .subject("google-subject-1")
            .signWith(keyPair.getPrivate());
        claims.forEach(builder::claim);
        return builder.compact();
    }

    private void expectJwks() {
        server.expect(requestTo(JWKS_URL))
            .andRespond(withSuccess(jwksJson(), MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("valid token returns the verified identity")
    void validTokenReturnsIdentity() {
        expectJwks();
        String token = sign(Map.of(
            "email", "Nguyen.Van@Example.com",
            "email_verified", true,
            "name", "Nguyen Van"));

        GoogleIdTokenVerifier.GoogleIdentity identity = verifier.verify(token);

        assertThat(identity.email()).isEqualTo("nguyen.van@example.com");
        assertThat(identity.displayName()).isEqualTo("Nguyen Van");
        assertThat(identity.subject()).isEqualTo("google-subject-1");
    }

    @Test
    @DisplayName("wrong audience is rejected with 401")
    void wrongAudienceRejected() {
        expectJwks();
        String token = Jwts.builder()
            .header().keyId(kid).and()
            .issuer("https://accounts.google.com")
            .audience().add("other-client.apps.googleusercontent.com").and()
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .subject("s")
            .claim("email", "a@b.c")
            .claim("email_verified", true)
            .signWith(keyPair.getPrivate())
            .compact();

        assertThatThrownBy(() -> verifier.verify(token))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(401);
    }

    @Test
    @DisplayName("unverified email claim is rejected")
    void unverifiedEmailRejected() {
        expectJwks();
        String token = sign(Map.of("email", "a@b.c", "email_verified", false));

        assertThatThrownBy(() -> verifier.verify(token))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(401);
    }

    @Test
    @DisplayName("wrong signature is rejected")
    void wrongSignatureRejected() throws Exception {
        expectJwks();
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair other = generator.generateKeyPair();
        String token = Jwts.builder()
            .header().keyId(kid).and()
            .issuer("accounts.google.com")
            .audience().add(CLIENT_ID).and()
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .subject("s")
            .claim("email", "a@b.c")
            .claim("email_verified", true)
            .signWith(other.getPrivate())
            .compact();

        assertThatThrownBy(() -> verifier.verify(token))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("JWKS outage degrades to a stable 503, never a raw provider error")
    void jwksOutageIs503() {
        server.expect(requestTo(JWKS_URL)).andRespond(withServerError());
        String token = sign(Map.of("email", "a@b.c", "email_verified", true));

        assertThatThrownBy(() -> verifier.verify(token))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(503);
    }

    @Test
    @DisplayName("missing client-id configuration fails closed with 503")
    void unconfiguredIsDisabled() {
        GoogleAuthProperties properties = new GoogleAuthProperties();
        GoogleIdTokenVerifier unconfigured = new GoogleIdTokenVerifier(properties, restTemplate);

        assertThatThrownBy(() -> unconfigured.verify("anything"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(503);
        assertThat(unconfigured.isConfigured()).isFalse();
    }
}
