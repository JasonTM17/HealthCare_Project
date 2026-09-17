package com.healthcare.storage.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.net.URI;

@Configuration
public class MinioConfig {

    @Value("${storage.endpoint:${minio.endpoint:${MINIO_ENDPOINT:http://localhost:9000}}}")
    private String endpoint;

    @Value("${storage.public-endpoint:}")
    private String publicEndpoint;

    @Value("${storage.access-key:${minio.access-key:${MINIO_ACCESS_KEY:${MINIO_ROOT_USER:}}}}")
    private String accessKey;

    @Value("${storage.secret-key:${minio.secret-key:${MINIO_SECRET_KEY:${MINIO_ROOT_PASSWORD:}}}}")
    private String secretKey;

    @Value("${storage.require-private-endpoint:false}")
    private boolean requirePrivateEndpoint;

    @Value("${storage.region:}")
    private String region;

    @Bean
    @Primary
    public MinioClient minioClient() {
        StorageEndpointPolicy.validatePrivateEndpoint(requirePrivateEndpoint, endpoint, accessKey, secretKey);
        MinioClient.Builder builder = MinioClient.builder()
            .endpoint(endpoint.trim())
            .credentials(effectiveAccessKey(), effectiveSecretKey());
        if (region != null && !region.isBlank()) {
            builder.region(region.trim());
        }
        return builder.build();
    }

    /**
     * MinioClient refuses to build with empty credentials, and this bean is
     * created unconditionally — so a runtime that has no object storage at all
     * (uploads and consultations both default off, as in the hosted beta) still
     * needs a non-empty value here.
     *
     * <p>The sentinel is deliberately not a plausible credential: it cannot
     * authenticate against any real bucket, and
     * {@link com.healthcare.storage.FailClosedStoragePolicy} refuses to start a
     * runtime that enables uploads while the credentials are still blank or a
     * placeholder. That startup check is what makes the posture fail-closed —
     * an unconfigured runtime keeps working, a configured one must be real.
     */
    private static final String UNCONFIGURED = "storage-not-configured";

    private String effectiveAccessKey() {
        return accessKey == null || accessKey.isBlank() ? UNCONFIGURED : accessKey;
    }

    private String effectiveSecretKey() {
        return secretKey == null || secretKey.isBlank() ? UNCONFIGURED : secretKey;
    }

    /** Sign for the browser's endpoint, without rewriting a signed Host. */
    @Bean("consultationPresignClient")
    public MinioClient consultationPresignClient() {
        if (publicEndpoint == null || publicEndpoint.isBlank()) {
            return minioClient();
        }
        URI external;
        try {
            external = URI.create(publicEndpoint.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Public object storage endpoint is invalid");
        }
        if (external.getHost() == null || external.getUserInfo() != null
                || external.getQuery() != null || external.getFragment() != null
                || (external.getPath() != null && !external.getPath().isEmpty() && !"/".equals(external.getPath()))
                || !("https".equals(external.getScheme()) || "http".equals(external.getScheme()))) {
            throw new IllegalStateException("Public object storage endpoint must be an HTTP(S) origin");
        }
        if (requirePrivateEndpoint && !"https".equals(external.getScheme())) {
            throw new IllegalStateException("Hosted browser object storage requires HTTPS");
        }
        StorageEndpointPolicy.validatePrivateEndpoint(requirePrivateEndpoint, publicEndpoint, accessKey, secretKey);
        // Explicit region prevents MinIO from making bucket-location requests
        // through the browser endpoint, which may not be reachable in Docker.
        if (region == null || region.isBlank()) {
            throw new IllegalStateException("Storage region is required for a public signing endpoint");
        }
        return MinioClient.builder().endpoint(publicEndpoint.trim())
            .credentials(effectiveAccessKey(), effectiveSecretKey()).region(region.trim()).build();
    }
}
