package com.healthcare.storage;

import java.net.URI;
import java.util.Locale;

/**
 * Unpackaged defaults must not enable generic upload without AV.
 * The explicit {@code storage.allow-unscanned-upload} escape is for disposable
 * tests that exercise MIME/MinIO without a scanner — never for hosted runtimes.
 */
public final class FailClosedStoragePolicy {

    private FailClosedStoragePolicy() {
    }

    /**
     * Whether the endpoint targets the operator's own machine. A loopback
     * public endpoint is a local compose/dev runtime, not a hosted surface:
     * the hosted-only guards (HTTPS-only browser signing, hosted posture) do
     * not apply to it, while every other fail-closed rule still does.
     */
    public static boolean isLoopbackEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return false;
        }
        try {
            URI parsed = URI.create(endpoint.trim());
            String host = parsed.getHost();
            if (host == null) {
                return false;
            }
            if (host.startsWith("[") && host.endsWith("]")) {
                host = host.substring(1, host.length() - 1);
            }
            String normalized = host.toLowerCase(Locale.ROOT);
            return "localhost".equals(normalized)
                || "127.0.0.1".equals(normalized)
                || "0.0.0.0".equals(normalized)
                || "::1".equals(normalized);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public static void validate(boolean uploadEnabled, boolean avRequired, boolean allowUnscannedUpload) {
        if (uploadEnabled && !avRequired && !allowUnscannedUpload) {
            throw new IllegalStateException(
                "STORAGE_UPLOAD_ENABLED requires STORAGE_AV_REQUIRED unless STORAGE_ALLOW_UNSCANNED_UPLOAD is an explicit escape"
            );
        }
    }

    /**
     * Credential and endpoint posture for a runtime that actually stores files.
     *
     * <p>The endpoint guard ({@code storage.require-private-endpoint}) is what
     * makes {@link com.healthcare.storage.config.StorageEndpointPolicy} run, and
     * it defaulted to off — so enabling uploads without it accepted a public or
     * placeholder-configured bucket silently. Uploads now require the guard to
     * be on and the credentials to be real.
     *
     * <p>The guard's own default stays off rather than being flipped: the bean
     * that validates the endpoint is unconditional, so turning it on globally
     * would refuse to start a deployment that never touches object storage.
     * Configuring storage is what makes the stricter posture apply.
     */
    public static void validateStorageEnabledPosture(
            boolean storageEnabled,
            boolean requirePrivateEndpoint,
            String accessKey,
            String secretKey,
            boolean allowUnscannedUpload) {
        if (!storageEnabled) {
            return;
        }
        // The same disposable-runtime escape the AV rule above uses. A test that
        // enables storage against a local container and declares itself
        // unscanned is not a hosted runtime, and the private-endpoint guard
        // would reject its loopback endpoint by design.
        if (allowUnscannedUpload) {
            return;
        }
        if (!requirePrivateEndpoint) {
            throw new IllegalStateException(
                "STORAGE_UPLOAD_ENABLED requires STORAGE_REQUIRE_PRIVATE_ENDPOINT=true"
            );
        }
        if (isPlaceholder(accessKey) || isPlaceholder(secretKey)) {
            throw new IllegalStateException(
                "STORAGE_UPLOAD_ENABLED requires real object storage credentials"
            );
        }
    }

    private static boolean isPlaceholder(String value) {
        return value == null || value.isBlank()
            || "change-me".equalsIgnoreCase(value.trim())
            || "healthcare".equalsIgnoreCase(value.trim())
            || "minioadmin".equalsIgnoreCase(value.trim())
            || "storage-not-configured".equalsIgnoreCase(value.trim());
    }
}
