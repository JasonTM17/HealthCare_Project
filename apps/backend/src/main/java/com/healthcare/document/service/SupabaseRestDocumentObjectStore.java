package com.healthcare.document.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Supabase Storage REST adapter. Selected when {@code storage.backend=supabase}
 * because the MinIO client cannot address the Supabase S3 endpoint (its URL
 * carries a mandatory {@code /storage/v1/s3} path segment that MinIO rejects).
 * The REST surface keeps the same private-bucket contract: server-side
 * service-role calls only, no presigned URLs, downloads stay behind the
 * authorized backend endpoint.
 */
@Component
@ConditionalOnProperty(name = "storage.backend", havingValue = "supabase")
public class SupabaseRestDocumentObjectStore implements DocumentObjectStore {

    private final HttpClient httpClient;
    private final String endpoint;
    private final String apiBase;
    private final String bucket;
    private final String serviceKey;
    private final AtomicBoolean bucketReady = new AtomicBoolean(false);

    @Autowired
    public SupabaseRestDocumentObjectStore(
            @Value("${storage.endpoint:}") String endpoint,
            @Value("${storage.bucket:${minio.bucket:healthcare-files}}") String bucket,
            @Value("${storage.access-key:}") String accessKey,
            @Value("${storage.secret-key:}") String secretKey) {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .version(HttpClient.Version.HTTP_1_1)
            .build();
        this.endpoint = normalizeEndpoint(endpoint);
        this.apiBase = this.endpoint + "/storage/v1";
        this.bucket = bucket;
        // Supabase REST accepts the service-role JWT as both apikey and bearer;
        // access-key may carry a distinct apikey when operators choose to split.
        this.serviceKey = isRealCredential(accessKey) ? accessKey : secretKey;
    }

    @Override
    public void put(String objectKey, byte[] content, String contentType) throws Exception {
        ensureBucket();
        HttpRequest request = authed(objectUri(objectKey))
            .header("x-upsert", "true")
            .POST(HttpRequest.BodyPublishers.ofByteArray(content))
            .header("Content-Type", contentType)
            .build();
        require2xx(httpClient.send(request, HttpResponse.BodyHandlers.discarding()), "put");
    }

    @Override
    public InputStream get(String objectKey) throws Exception {
        ensureBucket();
        HttpRequest request = authed(objectUri(objectKey)).GET().build();
        HttpResponse<InputStream> response =
            httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        require2xx(response, "get");
        return response.body();
    }

    @Override
    public void delete(String objectKey) throws Exception {
        ensureBucket();
        HttpRequest request = authed(objectUri(objectKey)).DELETE().build();
        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() == 404) {
            return;
        }
        require2xx(response, "delete");
    }

    @Override
    public boolean isConfigured() {
        // A blank endpoint normalizes to "" but apiBase would still be
        // "/storage/v1" — configuredness must require the real endpoint too,
        // otherwise capabilities report true while every request 503s.
        return !endpoint.isBlank() && isRealCredential(serviceKey);
    }

    private void ensureBucket() throws Exception {
        if (bucketReady.get()) {
            return;
        }
        synchronized (bucketReady) {
            if (bucketReady.get()) {
                return;
            }
            HttpRequest probe = authed(apiBase + "/bucket/" + encodeSegment(bucket)).GET().build();
            HttpResponse<Void> response = httpClient.send(probe, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() == 404) {
                HttpRequest create = authed(apiBase + "/bucket")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"id\":\"" + bucket + "\",\"name\":\"" + bucket + "\",\"public\":false}"))
                    .build();
                require2xx(httpClient.send(create, HttpResponse.BodyHandlers.discarding()), "create-bucket");
            } else {
                require2xx(response, "probe-bucket");
            }
            bucketReady.set(true);
        }
    }

    private HttpRequest.Builder authed(String uri) {
        return HttpRequest.newBuilder(URI.create(uri))
            .timeout(Duration.ofSeconds(60))
            .header("Authorization", "Bearer " + serviceKey)
            .header("apikey", serviceKey);
    }

    private String objectUri(String objectKey) {
        StringBuilder encoded = new StringBuilder();
        for (String segment : objectKey.split("/")) {
            if (encoded.length() > 0) {
                encoded.append('/');
            }
            encoded.append(URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"));
        }
        return apiBase + "/object/" + encodeSegment(bucket) + "/" + encoded;
    }

    private static String encodeSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String normalizeEndpoint(String endpoint) {
        if (endpoint == null) {
            return "";
        }
        String trimmed = endpoint.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static void require2xx(HttpResponse<?> response, String op) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(
                "Supabase storage " + op + " failed with status " + response.statusCode());
        }
    }

    private static boolean isRealCredential(String value) {
        return value != null && !value.isBlank() && !"storage-not-configured".equals(value.trim());
    }
}
