package com.healthcare.storage.service;

import com.healthcare.storage.config.StorageEndpointPolicy;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.http.Method;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Fail-closed consultation attachment boundary backed by MinIO/S3-compatible
 * object storage.  Generic clinical file uploads continue to use
 * {@link FileStorageService}; this service deliberately has a separate API and
 * lifecycle so consultation attachments cannot silently enter other paths.
 */
@Service
public class ConsultationAttachmentStorageService implements ConsultationAttachmentStorage {

    private static final long DEFAULT_MAX_BYTES = 10_485_760L;
    private static final int DEFAULT_URL_TTL_SECONDS = 300;
    private static final int MAX_URL_TTL_SECONDS = 900;
    private static final Duration DEFAULT_SCAN_LEASE = Duration.ofMinutes(2);
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "application/pdf");

    private final MinioClient minioClient;
    private final MinioClient presignClient;
    private final AttachmentScanner scanner;
    private final AttachmentScanLeaseStore leaseStore;
    private final AttachmentScanAuditHook auditHook;
    private final boolean enabled;
    private final String endpoint;
    private final String accessKey;
    private final String secretKey;
    private final boolean requirePrivateEndpoint;
    private final String bucket;
    private final long maxBytes;
    private final int putUrlTtlSeconds;
    private final int getUrlTtlSeconds;
    private final Duration scanLeaseDuration;
    private final Clock clock;
    private final ConsultationObjectKeyGenerator keyGenerator;
    private final boolean keySigningSecretConfigured;

    /** Spring runtime constructor. */
    @Autowired
    public ConsultationAttachmentStorageService(
            MinioClient minioClient,
            @Qualifier("consultationPresignClient") MinioClient presignClient,
            ObjectProvider<AttachmentScanner> scannerProvider,
            ObjectProvider<AttachmentScanLeaseStore> leaseStoreProvider,
            ObjectProvider<AttachmentScanAuditHook> auditHookProvider,
            @Value("${storage.consultation.enabled:${storage.upload-enabled:false}}") boolean enabled,
            @Value("${storage.endpoint:${minio.endpoint:${MINIO_ENDPOINT:}}}") String endpoint,
            @Value("${storage.access-key:${minio.access-key:${MINIO_ACCESS_KEY:}}}") String accessKey,
            @Value("${storage.secret-key:${minio.secret-key:${MINIO_SECRET_KEY:}}}") String secretKey,
            @Value("${storage.require-private-endpoint:false}") boolean requirePrivateEndpoint,
            @Value("${storage.bucket:${minio.bucket:healthcare-files}}") String bucket,
            @Value("${storage.max-file-size-bytes:10485760}") long maxBytes,
            @Value("${storage.consultation.put-url-ttl-seconds:300}") int putUrlTtlSeconds,
            @Value("${storage.consultation.get-url-ttl-seconds:300}") int getUrlTtlSeconds,
            @Value("${storage.consultation.scan-lease-seconds:120}") int scanLeaseSeconds,
            @Value("${storage.consultation.key-signing-secret:}") String keySigningSecret) {
        this(
                minioClient,
                presignClient,
                scannerProvider == null ? new UnavailableAttachmentScanner()
                        : scannerProvider.getIfAvailable(UnavailableAttachmentScanner::new),
                leaseStoreProvider == null ? new InMemoryAttachmentScanLeaseStore()
                        : leaseStoreProvider.getIfAvailable(InMemoryAttachmentScanLeaseStore::new),
                auditHookProvider == null ? new NoopAttachmentScanAuditHook()
                        : auditHookProvider.getIfAvailable(NoopAttachmentScanAuditHook::new),
                enabled,
                endpoint,
                accessKey,
                secretKey,
                requirePrivateEndpoint,
                bucket,
                maxBytes,
                putUrlTtlSeconds,
                getUrlTtlSeconds,
                Duration.ofSeconds(scanLeaseSeconds),
                Clock.systemUTC(),
                keySigningSecret);
    }

    /** Convenient deterministic constructor for focused unit tests/adapters. */
    public ConsultationAttachmentStorageService(
            MinioClient minioClient,
            AttachmentScanner scanner,
            AttachmentScanLeaseStore leaseStore,
            AttachmentScanAuditHook auditHook) {
        this(
                minioClient,
                minioClient,
                scanner,
                leaseStore,
                auditHook,
                true,
                "http://localhost:9000",
                "healthcare",
                "change-me",
                false,
                "healthcare-files",
                DEFAULT_MAX_BYTES,
                DEFAULT_URL_TTL_SECONDS,
                DEFAULT_URL_TTL_SECONDS,
                DEFAULT_SCAN_LEASE,
                Clock.systemUTC(),
                "unit-test-signing-secret");
    }

    ConsultationAttachmentStorageService(
            MinioClient minioClient,
            MinioClient presignClient,
            AttachmentScanner scanner,
            AttachmentScanLeaseStore leaseStore,
            AttachmentScanAuditHook auditHook,
            boolean enabled,
            String endpoint,
            String accessKey,
            String secretKey,
            boolean requirePrivateEndpoint,
            String bucket,
            long maxBytes,
            int putUrlTtlSeconds,
            int getUrlTtlSeconds,
            Duration scanLeaseDuration,
            Clock clock,
            String keySigningSecret) {
        this.minioClient = minioClient;
        this.presignClient = presignClient;
        this.scanner = scanner;
        this.leaseStore = leaseStore;
        this.auditHook = auditHook == null ? new NoopAttachmentScanAuditHook() : auditHook;
        this.enabled = enabled;
        this.endpoint = endpoint == null ? "" : endpoint.trim();
        this.accessKey = accessKey == null ? "" : accessKey.trim();
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.requirePrivateEndpoint = requirePrivateEndpoint;
        this.bucket = bucket == null ? "" : bucket.trim();
        this.maxBytes = maxBytes > 0 ? Math.min(maxBytes, DEFAULT_MAX_BYTES) : DEFAULT_MAX_BYTES;
        this.putUrlTtlSeconds = normalizeTtl(putUrlTtlSeconds);
        this.getUrlTtlSeconds = normalizeTtl(getUrlTtlSeconds);
        this.scanLeaseDuration = normalizeLease(scanLeaseDuration);
        this.clock = clock == null ? Clock.systemUTC() : clock;
        this.keySigningSecretConfigured = keySigningSecret != null && keySigningSecret.getBytes(StandardCharsets.UTF_8).length >= 32;
        this.keyGenerator = new ConsultationObjectKeyGenerator(keySigningSecret);
    }

    @Override
    public boolean isEnabled() {
        return enabled && providerConfigured();
    }

    @Override
    public UploadIntent createUploadIntent(UploadIntentRequest request) {
        if (!isEnabled()) {
            return UploadIntent.disabled(failureForUnavailableProvider());
        }
        if (!validIntentRequest(request)) {
            return UploadIntent.disabled("ATTACHMENT_REQUEST_INVALID");
        }
        UUID attachmentId = UUID.randomUUID();
        String objectKey = keyGenerator.generateUpload(request.threadId(), attachmentId);
        try {
            URI signedUrl = presign(objectKey, Method.PUT, putUrlTtlSeconds);
            return new UploadIntent(
                    Availability.ENABLED,
                    attachmentId,
                    objectKey,
                    signedUrl,
                    Instant.now(clock).plusSeconds(putUrlTtlSeconds),
                    "PENDING",
                    null);
        } catch (Exception ex) {
            // Do not expose provider details or fall back to localhost.
            return UploadIntent.disabled("ATTACHMENT_PRESIGN_UNAVAILABLE");
        }
    }

    @Override
    public boolean isUploadPresent(CompletionRequest request) {
        if (!isEnabled() || !validCompletionRequest(request)
                || !keyGenerator.isValid(request.privateObjectKey(), ConsultationObjectKeyGenerator.Purpose.UPLOAD,
                    request.threadId(), request.attachmentId())) {
            return false;
        }
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                .bucket(bucket).object(request.privateObjectKey()).build());
            return stat.size() == request.expectedSizeBytes();
        } catch (Exception exception) {
            return false;
        }
    }

    @Override
    public CompletionResult scanWithLease(CompletionRequest request, AttachmentScanAuditHook.ScanLease lease) {
        if (!isEnabled() || !validCompletionRequest(request) || lease == null
                || lease.leaseId() == null || !request.attachmentId().equals(lease.attachmentId())
                || !request.privateObjectKey().equals(lease.objectKey())
                || !keyGenerator.isValid(request.privateObjectKey(), ConsultationObjectKeyGenerator.Purpose.UPLOAD,
                    request.threadId(), request.attachmentId())) {
            return CompletionResult.pending(request == null ? null : request.attachmentId(),
                request == null ? null : request.privateObjectKey(), "ATTACHMENT_SCAN_UNAVAILABLE");
        }
        return verifyAndScan(request, lease);
    }

    @Override
    public CompletionResult complete(CompletionRequest request) {
        if (!isEnabled()) {
            return CompletionResult.disabled(
                    request == null ? null : request.attachmentId(),
                    request == null ? null : request.privateObjectKey(),
                    failureForUnavailableProvider());
        }
        if (!validCompletionRequest(request)) {
            return CompletionResult.rejected(
                    request == null ? null : request.attachmentId(),
                    request == null ? null : request.privateObjectKey(),
                    null,
                    0,
                    null,
                    "ATTACHMENT_REQUEST_INVALID");
        }
        if (!keyGenerator.isValid(
                request.privateObjectKey(), request.threadId(), request.attachmentId())) {
            return CompletionResult.rejected(
                    request.attachmentId(), request.privateObjectKey(), null, 0, null,
                    "ATTACHMENT_OBJECT_KEY_FORGED");
        }
        if (!keyGenerator.isValid(
                request.privateObjectKey(), ConsultationObjectKeyGenerator.Purpose.UPLOAD,
                request.threadId(), request.attachmentId())) {
            return CompletionResult.rejected(
                    request.attachmentId(), request.privateObjectKey(), null, 0, null,
                    "ATTACHMENT_OBJECT_KEY_PURPOSE_INVALID");
        }

        var lease = leaseStore == null
                ? java.util.Optional.<AttachmentScanAuditHook.ScanLease>empty()
                : leaseStore.tryAcquire(request.attachmentId(), request.privateObjectKey(), scanLeaseDuration);
        if (lease.isEmpty()) {
            return CompletionResult.pending(
                    request.attachmentId(), request.privateObjectKey(), "ATTACHMENT_SCAN_IN_PROGRESS");
        }
        AttachmentScanAuditHook.ScanLease acquired = lease.get();
        safeAudit(() -> auditHook.onLeaseAcquired(acquired));
        try {
            return verifyAndScan(request, acquired);
        } finally {
            if (leaseStore != null) {
                leaseStore.release(acquired);
            }
            safeAudit(() -> auditHook.onLeaseReleased(acquired));
        }
    }

    @Override
    public DownloadUrl issueDownloadUrl(DownloadRequest request) {
        if (!isEnabled()) {
            return DownloadUrl.disabled(
                    request == null ? null : request.attachmentId(),
                    failureForUnavailableProvider());
        }
        if (!validDownloadRequest(request)) {
            return DownloadUrl.disabled(
                    request == null ? null : request.attachmentId(), "ATTACHMENT_REQUEST_INVALID");
        }
        if (request.persistedScanStatus() != ScanStatus.CLEAN) {
            return DownloadUrl.disabled(request.attachmentId(), "ATTACHMENT_NOT_CLEAN");
        }
        if (!keyGenerator.isValid(
                request.privateObjectKey(), request.threadId(), request.attachmentId())) {
            return DownloadUrl.disabled(request.attachmentId(), "ATTACHMENT_OBJECT_KEY_FORGED");
        }
        if (!keyGenerator.isValid(
                request.privateObjectKey(), ConsultationObjectKeyGenerator.Purpose.VERIFIED,
                request.threadId(), request.attachmentId())) {
            return DownloadUrl.disabled(
                    request.attachmentId(), "ATTACHMENT_OBJECT_KEY_PURPOSE_INVALID");
        }
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket(bucket).object(request.privateObjectKey()).build());
            if (request.expectedSizeBytes() != null
                    && stat.size() != request.expectedSizeBytes()) {
                return DownloadUrl.disabled(request.attachmentId(), "ATTACHMENT_SIZE_MISMATCH");
            }
            URI signedUrl = presign(request.privateObjectKey(), Method.GET, getUrlTtlSeconds);
            return new DownloadUrl(
                    Availability.ENABLED,
                    request.attachmentId(),
                    signedUrl,
                    Instant.now(clock).plusSeconds(getUrlTtlSeconds),
                    null);
        } catch (Exception ex) {
            return DownloadUrl.disabled(request.attachmentId(), "ATTACHMENT_DOWNLOAD_UNAVAILABLE");
        }
    }

    @Override
    public void deleteObjects(Collection<String> privateObjectKeys) {
        if (privateObjectKeys == null || privateObjectKeys.isEmpty()) {
            return;
        }
        if (!enabled) {
            throw new IllegalStateException("attachment storage is disabled while objects require cleanup");
        }
        for (String objectKey : privateObjectKeys) {
            if (objectKey == null || objectKey.isBlank()
                    || !objectKey.startsWith("private/consultations/")
                    || objectKey.contains("..")
                    || objectKey.indexOf('\\') >= 0
                    || objectKey.chars().anyMatch(Character::isISOControl)) {
                throw new IllegalStateException("attachment cleanup key is invalid");
            }
            try {
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectKey)
                        .build());
            } catch (Exception ex) {
                // S3/MinIO delete is idempotent for a missing key. Any other
                // failure is closed so retention can retry without deleting
                // the authoritative database rows.
                throw new IllegalStateException("attachment cleanup failed", ex);
            }
        }
    }

    private CompletionResult verifyAndScan(
            CompletionRequest request, AttachmentScanAuditHook.ScanLease lease) {
        StatObjectResponse stat;
        try {
            stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket(bucket).object(request.privateObjectKey()).build());
        } catch (Exception ex) {
            return CompletionResult.pending(request.attachmentId(), request.privateObjectKey(), "ATTACHMENT_OBJECT_NOT_FOUND");
        }
        long declaredObjectSize = stat.size();
        if (declaredObjectSize < 1 || declaredObjectSize > maxBytes
                || declaredObjectSize != request.expectedSizeBytes()) {
            return reject(request, null, declaredObjectSize, null, "ATTACHMENT_SIZE_MISMATCH");
        }

        byte[] content;
        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder().bucket(bucket).object(request.privateObjectKey()).build())) {
            content = readLimited(stream);
        } catch (Exception ex) {
            return CompletionResult.pending(request.attachmentId(), request.privateObjectKey(), "ATTACHMENT_OBJECT_READ_FAILED");
        }
        if (content.length != declaredObjectSize) {
            return reject(request, null, content.length, null, "ATTACHMENT_SIZE_MISMATCH");
        }

        String actualMime = detectMime(content);
        String actualSha = sha256(content);
        if (actualMime == null || !actualMime.equals(normalizeMime(request.expectedMimeType()))) {
            return reject(request, actualMime, content.length, actualSha, "ATTACHMENT_MIME_MISMATCH");
        }
        String metadataMime = normalizeMime(stat.contentType());
        if (metadataMime != null && !metadataMime.isBlank()
                && !"application/octet-stream".equals(metadataMime)
                && !actualMime.equals(metadataMime)) {
            return reject(request, actualMime, content.length, actualSha, "ATTACHMENT_MIME_METADATA_MISMATCH");
        }
        if (!constantTimeEquals(actualSha, request.expectedSha256().toLowerCase(Locale.ROOT))) {
            return reject(request, actualMime, content.length, actualSha, "ATTACHMENT_HASH_MISMATCH");
        }

        AttachmentScanner.ScanResult scanResult;
        try {
            scanResult = scanner == null
                    ? AttachmentScanner.ScanResult.unavailable("scanner-not-configured")
                    : scanner.scan(new AttachmentScanner.ScanRequest(
                            request.privateObjectKey(), actualMime, content.length, content));
        } catch (RuntimeException ex) {
            scanResult = AttachmentScanner.ScanResult.error("scanner-failed");
        }
        if (scanResult == null || scanResult.verdict() != AttachmentScanner.Verdict.CLEAN) {
            String code = scanResult == null || scanResult.verdict() == AttachmentScanner.Verdict.UNAVAILABLE
                    ? "ATTACHMENT_SCANNER_UNAVAILABLE"
                    : scanResult.verdict() == AttachmentScanner.Verdict.INFECTED
                    ? "ATTACHMENT_REJECTED_BY_SCANNER"
                    : "ATTACHMENT_SCANNER_FAILED";
            if (scanResult != null && scanResult.verdict() == AttachmentScanner.Verdict.INFECTED) {
                return reject(request, actualMime, content.length, actualSha, code);
            }
            return CompletionResult.pending(request.attachmentId(), request.privateObjectKey(), code);
        }
        String verifiedObjectKey = keyGenerator.generateVerified(
                request.threadId(), request.attachmentId());
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(verifiedObjectKey)
                            .stream(new ByteArrayInputStream(content), content.length, -1)
                            .contentType(actualMime)
                            .build());
        } catch (Exception ex) {
            return CompletionResult.pending(request.attachmentId(), request.privateObjectKey(),
                "ATTACHMENT_VERIFIED_PROMOTION_FAILED");
        }
        final AttachmentScanner.ScanResult cleanResult = scanResult;
        final byte[] verifiedContent = content;
        safeAudit(() -> auditHook.onScanCompleted(new AttachmentScanAuditHook.ScanAudit(
                request.attachmentId(),
                verifiedObjectKey,
                actualMime,
                verifiedContent.length,
                actualSha,
                cleanResult.verdict(),
                Instant.now(clock))));
        return new CompletionResult(
                Availability.ENABLED,
                request.attachmentId(),
                verifiedObjectKey,
                actualMime,
                content.length,
                actualSha,
                ScanStatus.CLEAN,
                Instant.now(clock),
                null);
    }

    private CompletionResult reject(
            CompletionRequest request,
            String actualMime,
            long actualSize,
            String actualSha,
            String code) {
        Instant now = Instant.now(clock);
        safeAudit(() -> auditHook.onScanRejected(new AttachmentScanAuditHook.RejectionAudit(
                request.attachmentId(), request.privateObjectKey(), code, now)));
        return new CompletionResult(
                Availability.ENABLED,
                request.attachmentId(),
                request.privateObjectKey(),
                actualMime,
                actualSize,
                actualSha,
                ScanStatus.REJECTED,
                now,
                code);
    }

    private URI presign(String objectKey, Method method, int ttlSeconds) throws Exception {
        String url = presignClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(method)
                        .bucket(bucket)
                        .object(objectKey)
                        .expiry(ttlSeconds, TimeUnit.SECONDS)
                        .build());
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("object store returned an empty signed URL");
        }
        return URI.create(url);
    }

    private byte[] readLimited(InputStream stream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream((int) Math.min(maxBytes, 8192));
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        while ((read = stream.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new IOException("object exceeds configured size limit");
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private String detectMime(byte[] bytes) {
        if (bytes.length >= 5
                && bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F'
                && bytes[4] == '-') {
            return "application/pdf";
        }
        if (bytes.length >= 3
                && (bytes[0] & 0xff) == 0xff
                && (bytes[1] & 0xff) == 0xd8
                && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 'P'
                && bytes[2] == 'N'
                && bytes[3] == 'G'
                && (bytes[4] & 0xff) == 0x0d
                && (bytes[5] & 0xff) == 0x0a
                && (bytes[6] & 0xff) == 0x1a
                && (bytes[7] & 0xff) == 0x0a) {
            return "image/png";
        }
        return null;
    }

    private String sha256(byte[] bytes) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private boolean validIntentRequest(UploadIntentRequest request) {
        return request != null
                && request.threadId() != null
                && request.messageId() != null
                && ALLOWED_MIME_TYPES.contains(normalizeMime(request.requestedMimeType()))
                && request.declaredSizeBytes() > 0
                && request.declaredSizeBytes() <= maxBytes
                && request.declaredSha256() != null
                && request.declaredSha256().matches("(?i)[0-9a-f]{64}");
    }

    private boolean validCompletionRequest(CompletionRequest request) {
        return request != null
                && request.threadId() != null
                && request.attachmentId() != null
                && request.privateObjectKey() != null
                && request.expectedSizeBytes() > 0
                && request.expectedSizeBytes() <= maxBytes
                && ALLOWED_MIME_TYPES.contains(normalizeMime(request.expectedMimeType()))
                && request.expectedSha256() != null
                && request.expectedSha256().matches("(?i)[0-9a-f]{64}");
    }

    private boolean validDownloadRequest(DownloadRequest request) {
        return request != null
                && request.threadId() != null
                && request.attachmentId() != null
                && request.privateObjectKey() != null
                && !request.privateObjectKey().isBlank()
                && (request.expectedSizeBytes() == null || request.expectedSizeBytes() > 0);
    }

    private boolean providerConfigured() {
        if (minioClient == null || presignClient == null || endpoint.isBlank() || bucket.isBlank()
                || accessKey.isBlank() || secretKey.isBlank()) {
            return false;
        }
        if (requirePrivateEndpoint && !keySigningSecretConfigured) {
            return false;
        }
        try {
            StorageEndpointPolicy.validatePrivateEndpoint(
                    requirePrivateEndpoint, endpoint, accessKey, secretKey);
            return true;
        } catch (IllegalStateException ex) {
            return false;
        }
    }

    private String failureForUnavailableProvider() {
        return enabled ? "PRIVATE_STORAGE_NOT_CONFIGURED" : "ATTACHMENT_STORAGE_DISABLED";
    }

    private String normalizeMime(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII), right.getBytes(StandardCharsets.US_ASCII));
    }

    private int normalizeTtl(int requested) {
        if (requested <= 0) {
            return DEFAULT_URL_TTL_SECONDS;
        }
        return Math.min(requested, MAX_URL_TTL_SECONDS);
    }

    private Duration normalizeLease(Duration requested) {
        if (requested == null || requested.isNegative() || requested.isZero()) {
            return DEFAULT_SCAN_LEASE;
        }
        return requested.compareTo(Duration.ofMinutes(15)) > 0
                ? Duration.ofMinutes(15)
                : requested;
    }

    private void safeAudit(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException ignored) {
            // Audit failures never turn a verified object into a CLEAN result
            // by themselves; the persisted consultation status remains the
            // source of truth and the caller can retry the audit hook.
        }
    }
}
