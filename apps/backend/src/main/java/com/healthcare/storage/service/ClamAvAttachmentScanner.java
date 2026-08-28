package com.healthcare.storage.service;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Small HTTP adapter for a trusted ClamAV/scanner sidecar.  The sidecar
 * contract is intentionally narrow: POST raw bytes to the configured URL and
 * return either {@code CLEAN} or a non-clean status.  Deployments may replace
 * this bean with a native clamd adapter without changing consultation code.
 */
public final class ClamAvAttachmentScanner implements AttachmentScanner {

    private final RestClient client;
    private final String endpoint;
    private final String serviceToken;

    public ClamAvAttachmentScanner(
            RestClient.Builder builder,
            String endpoint,
            String serviceToken,
            String allowedHosts) {
        if (builder == null) {
            throw new IllegalArgumentException("scanner HTTP client is required");
        }
        this.client = builder.build();
        this.endpoint = validateEndpoint(endpoint, allowedHosts);
        this.serviceToken = serviceToken == null ? "" : serviceToken.trim();
    }

    private String validateEndpoint(String rawEndpoint, String rawAllowedHosts) {
        String candidate = rawEndpoint == null ? "" : rawEndpoint.trim();
        if (candidate.isBlank()) {
            return "";
        }

        URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("scanner endpoint must be an absolute HTTP(S) URL", exception);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!("http".equals(scheme) || "https".equals(scheme))
                || host.isBlank()
                || uri.getUserInfo() != null
                || uri.getFragment() != null
                || uri.getQuery() != null) {
            throw new IllegalArgumentException("scanner endpoint must be an absolute HTTP(S) URL without credentials, query, or fragment");
        }

        Set<String> allowedHosts = Arrays.stream((rawAllowedHosts == null ? "" : rawAllowedHosts).split(","))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .map(value -> value.toLowerCase(Locale.ROOT))
            .collect(Collectors.toUnmodifiableSet());
        if (allowedHosts.isEmpty() || allowedHosts.stream().anyMatch(value -> value.contains("*") || value.contains(":") || value.contains("/"))) {
            throw new IllegalArgumentException("scanner allowed hosts must contain exact hostnames only");
        }
        if (!allowedHosts.contains(host)) {
            throw new IllegalArgumentException("scanner endpoint host is not allowlisted");
        }
        return uri.toString();
    }

    @Override
    public ScanResult scan(ScanRequest request) {
        if (endpoint.isBlank() || serviceToken.isBlank()) {
            return ScanResult.unavailable("scanner-not-configured");
        }
        try {
            String body = client.post()
                    .uri(endpoint)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken)
                    .header("X-Object-Key", request.objectKey())
                    .header("X-Content-SHA256", sha256(request.content()))
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(request.content())
                    .retrieve()
                    .body(String.class);
            String verdict = body == null ? "" : body.trim().toUpperCase(Locale.ROOT);
            if (verdict.equals("CLEAN") || verdict.contains("\"STATUS\":\"CLEAN\"")) {
                return ScanResult.clean();
            }
            if (verdict.contains("FOUND") || verdict.contains("INFECTED")
                    || verdict.contains("REJECTED") || verdict.contains("MALWARE")) {
                return ScanResult.infected("scanner-rejected");
            }
            return ScanResult.error("scanner-invalid-response");
        } catch (RestClientException ex) {
            return ScanResult.error("scanner-request-failed");
        }
    }

    private String sha256(byte[] bytes) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(bytes));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
