package com.healthcare.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Google Identity Services (GIS) sign-in configuration. The feature is
 * disabled unless a real OAuth Web client id is configured; when unset the
 * verifier fails closed and the grant returns a stable 503 so the UI can hide
 * or explain the button.
 *
 * <ul>
 *   <li>{@code client-id}: the Google OAuth 2.0 Web client id whose ID tokens
 *       this deployment accepts ({@code aud} must match exactly).</li>
 *   <li>{@code jwks-url}: Google signing-key document. Overridable for tests;
 *       must stay on https in any real deployment.</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "healthcare.auth.google")
public class GoogleAuthProperties {

    private String clientId = "";

    private String jwksUrl = "https://www.googleapis.com/oauth2/v3/certs";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getJwksUrl() {
        return jwksUrl;
    }

    public void setJwksUrl(String jwksUrl) {
        this.jwksUrl = jwksUrl;
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
    }
}
