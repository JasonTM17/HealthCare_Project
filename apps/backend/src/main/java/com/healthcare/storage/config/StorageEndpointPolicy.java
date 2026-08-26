package com.healthcare.storage.config;

import java.net.URI;

/** Fail-closed checks for non-local S3-compatible object storage. */
public final class StorageEndpointPolicy {

    private StorageEndpointPolicy() {
    }

    public static void validatePrivateEndpoint(
            boolean required,
            String endpoint,
            String accessKey,
            String secretKey) {
        if (!required) {
            return;
        }
        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalStateException("Private object storage endpoint is required outside local runtime");
        }
        URI parsed;
        try {
            parsed = URI.create(endpoint.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Private object storage endpoint is invalid", ex);
        }
        String host = parsed.getHost();
        if (host == null || host.isBlank() || isLoopback(host)) {
            throw new IllegalStateException("Private object storage endpoint must not be localhost");
        }
        if (!"http".equalsIgnoreCase(parsed.getScheme())
                && !"https".equalsIgnoreCase(parsed.getScheme())) {
            throw new IllegalStateException("Private object storage endpoint must use HTTP or HTTPS");
        }
        if (parsed.getUserInfo() != null || parsed.getQuery() != null || parsed.getFragment() != null) {
            throw new IllegalStateException("Private object storage endpoint must not embed credentials or query data");
        }
        if (isPlaceholder(accessKey) || isPlaceholder(secretKey)) {
            throw new IllegalStateException("Private object storage credentials are required");
        }
    }

    private static boolean isLoopback(String host) {
        String normalized = host;
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return "localhost".equalsIgnoreCase(normalized)
            || "127.0.0.1".equals(normalized)
            || "0.0.0.0".equals(normalized)
            || "::1".equals(normalized);
    }

    private static boolean isPlaceholder(String value) {
        return value == null || value.isBlank()
            || "change-me".equalsIgnoreCase(value.trim())
            || "healthcare".equalsIgnoreCase(value.trim())
            || "minioadmin".equalsIgnoreCase(value.trim());
    }
}
