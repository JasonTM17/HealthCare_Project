package com.healthcare.storage.service;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Locale;

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

    public ClamAvAttachmentScanner(RestClient.Builder builder, String endpoint, String serviceToken) {
        if (builder == null) {
            throw new IllegalArgumentException("scanner HTTP client is required");
        }
        this.client = builder.build();
        this.endpoint = endpoint == null ? "" : endpoint.trim();
        this.serviceToken = serviceToken == null ? "" : serviceToken.trim();
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
