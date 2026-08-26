package com.healthcare.storage.service;

import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectResponse;
import okhttp3.Headers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

class ConsultationAttachmentStorageServiceTest {

    private MinioClient minio;
    private AttachmentScanner scanner;
    private AttachmentScanLeaseStore leases;
    private AttachmentScanAuditHook audit;
    private ConsultationAttachmentStorageService service;

    @BeforeEach
    void setUp() throws Exception {
        minio = mock(MinioClient.class);
        scanner = request -> AttachmentScanner.ScanResult.clean();
        leases = new InMemoryAttachmentScanLeaseStore();
        audit = mock(AttachmentScanAuditHook.class);
        doReturn("https://objects.example.test/signed").when(minio).getPresignedObjectUrl(any());
        service = new ConsultationAttachmentStorageService(minio, scanner, leases, audit);
    }

    @Test
    void uploadAcknowledgmentOnlyHeadsAndDoesNotReadOrScanBytes() throws Exception {
        UUID thread = UUID.randomUUID();
        var intent = service.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
            thread, UUID.randomUUID(), "image/jpeg", 5, "a".repeat(64), null));
        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn(5L).when(stat).size();
        doReturn(stat).when(minio).statObject(any());
        assertThat(service.isUploadPresent(new ConsultationAttachmentStorage.CompletionRequest(
            thread, intent.attachmentId(), intent.privateObjectKey(), "image/jpeg", 5, "a".repeat(64)))).isTrue();
        verify(minio, never()).getObject(any());
        verify(minio, never()).putObject(any());
        verify(audit, never()).onScanCompleted(any());
    }

    @Test
    void cleanCompletionPromotesExactVerifiedBytesToNewServerOnlyKey() throws Exception {
        UUID threadId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        String hash = sha256(jpeg);
        ConsultationAttachmentStorage.UploadIntent intent = service.createUploadIntent(
                new ConsultationAttachmentStorage.UploadIntentRequest(
                        threadId, messageId, "image/jpeg", jpeg.length, hash,
                        "private/consultations/another-thread/forged"));

        assertThat(intent.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.ENABLED);
        assertThat(intent.privateObjectKey()).isNotEqualTo("private/consultations/another-thread/forged");
        assertThat(intent.privateObjectKey()).startsWith("private/consultations/" + threadId + "/");

        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn((long) jpeg.length).when(stat).size();
        doReturn("image/jpeg").when(stat).contentType();
        doReturn(stat).when(minio).statObject(any());
        doAnswer(invocation -> new GetObjectResponse(
                Headers.of(), "healthcare-files", "us-east-1", intent.privateObjectKey(),
                new ByteArrayInputStream(jpeg))).when(minio).getObject(any());

        ConsultationAttachmentStorage.CompletionResult result = service.complete(
                new ConsultationAttachmentStorage.CompletionRequest(
                        threadId, intent.attachmentId(), intent.privateObjectKey(),
                        "image/jpeg", jpeg.length, hash));

        assertThat(result.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.CLEAN);
        assertThat(result.actualMimeType()).isEqualTo("image/jpeg");
        assertThat(result.actualSha256()).isEqualTo(hash);
        assertThat(result.privateObjectKey()).isNotEqualTo(intent.privateObjectKey());
        assertThat(result.privateObjectKey()).contains("/verified/");
        var promoted = org.mockito.ArgumentCaptor.forClass(PutObjectArgs.class);
        verify(minio).putObject(promoted.capture());
        assertThat(promoted.getValue().object()).isEqualTo(result.privateObjectKey());
        assertThat(promoted.getValue().contentType()).isEqualTo("image/jpeg");
        assertThat(promoted.getValue().stream().readAllBytes()).containsExactly(jpeg);
        verify(audit).onScanCompleted(any());
    }

    @Test
    void downloadRejectsMutableUploadKeyEvenWhenPersistedCleanAndSizeMatches() throws Exception {
        UUID threadId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        var intent = service.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
                threadId, UUID.randomUUID(), "image/jpeg", jpeg.length, sha256(jpeg), null));

        var result = service.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                ConsultationAttachmentStorage.ScanStatus.CLEAN, (long) jpeg.length));

        assertThat(result.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.DISABLED);
        assertThat(result.failureCode()).isEqualTo("ATTACHMENT_OBJECT_KEY_PURPOSE_INVALID");
        verify(minio, never()).statObject(any());
    }

    @Test
    void mimeAndHashMismatchesRejectBeforeScanner() throws Exception {
        UUID threadId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        String hash = sha256(jpeg);
        ConsultationAttachmentStorage.UploadIntent intent = service.createUploadIntent(
                new ConsultationAttachmentStorage.UploadIntentRequest(
                        threadId, UUID.randomUUID(), "image/jpeg", jpeg.length, hash, "forged"));
        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn((long) jpeg.length).when(stat).size();
        doReturn("image/jpeg").when(stat).contentType();
        doReturn(stat).when(minio).statObject(any());
        doAnswer(invocation -> new GetObjectResponse(
                Headers.of(), "healthcare-files", "us-east-1", intent.privateObjectKey(),
                new ByteArrayInputStream(jpeg))).when(minio).getObject(any());

        var mimeMismatch = service.complete(new ConsultationAttachmentStorage.CompletionRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                "image/png", jpeg.length, hash));
        assertThat(mimeMismatch.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.REJECTED);
        assertThat(mimeMismatch.failureCode()).isEqualTo("ATTACHMENT_MIME_MISMATCH");

        var hashMismatch = service.complete(new ConsultationAttachmentStorage.CompletionRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                "image/jpeg", jpeg.length, "0".repeat(64)));
        assertThat(hashMismatch.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.REJECTED);
        assertThat(hashMismatch.failureCode()).isEqualTo("ATTACHMENT_HASH_MISMATCH");
    }

    @Test
    void signedUrlsAreShortLivedAndDownloadsRequireCleanStatus() throws Exception {
        UUID threadId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        // A generated key is needed for the download-boundary check.
        var intent = service.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
                threadId, UUID.randomUUID(), "image/jpeg", jpeg.length, sha256(jpeg), null));
        assertThat(intent.putUrlExpiresAt()).isAfter(Instant.now());
        assertThat(Duration.between(Instant.now(), intent.putUrlExpiresAt()).getSeconds())
                .isLessThanOrEqualTo(300);

        var pending = service.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                ConsultationAttachmentStorage.ScanStatus.PENDING, (long) jpeg.length));
        assertThat(pending.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.DISABLED);
        assertThat(pending.signedGetUrl()).isNull();

        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn((long) jpeg.length).when(stat).size();
        doReturn("image/jpeg").when(stat).contentType();
        doReturn(stat).when(minio).statObject(any());
        doReturn(new GetObjectResponse(
                Headers.of(), "healthcare-files", "us-east-1", intent.privateObjectKey(),
                new ByteArrayInputStream(jpeg))).when(minio).getObject(any());
        var completed = service.complete(new ConsultationAttachmentStorage.CompletionRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                "image/jpeg", jpeg.length, sha256(jpeg)));
        assertThat(completed.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.CLEAN);

        var clean = service.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
                threadId, intent.attachmentId(), completed.privateObjectKey(),
                ConsultationAttachmentStorage.ScanStatus.CLEAN, (long) jpeg.length));
        assertThat(clean.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.ENABLED);
        assertThat(clean.signedGetUrl()).isEqualTo(URI.create("https://objects.example.test/signed"));
        assertThat(clean.getUrlExpiresAt()).isAfter(Instant.now());
    }

    @Test
    void privateModeRejectsLocalhostInsteadOfFallingBack() {
        var privateOnly = new ConsultationAttachmentStorageService(
                minio, minio, scanner, leases, audit,
                true, "http://localhost:9000", "real-key", "real-secret", true,
                "healthcare-files", 10_485_760L, 300, 300, Duration.ofMinutes(2),
                java.time.Clock.systemUTC(), "test-secret");
        var result = privateOnly.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
                UUID.randomUUID(), UUID.randomUUID(), "image/jpeg", 3, "a".repeat(64), null));
        assertThat(result.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.DISABLED);
        assertThat(result.failureCode()).isEqualTo("PRIVATE_STORAGE_NOT_CONFIGURED");
    }

    @Test
    void usesPublicSignerButInternalClientForObjectAccess() throws Exception {
        MinioClient publicSigner = mock(MinioClient.class);
        doReturn("https://storage.example.test/signed").when(publicSigner).getPresignedObjectUrl(any());
        String keySecret = "unit-test-signing-secret";
        var separated = new ConsultationAttachmentStorageService(
            minio, publicSigner, scanner, leases, audit, true, "http://minio:9000",
            "local-key", "local-secret", false, "healthcare-files", 10485760, 300, 300,
            Duration.ofMinutes(2), java.time.Clock.systemUTC(), keySecret);
        UUID thread = UUID.randomUUID();
        var intent = separated.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
            thread, UUID.randomUUID(), "image/jpeg", 3, "a".repeat(64), null));
        assertThat(intent.signedPutUrl().getHost()).isEqualTo("storage.example.test");

        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn(3L).when(stat).size();
        doReturn(stat).when(minio).statObject(any());
        String verifiedKey = new ConsultationObjectKeyGenerator(keySecret).generateVerified(thread, intent.attachmentId());
        var download = separated.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
            thread, intent.attachmentId(), verifiedKey, ConsultationAttachmentStorage.ScanStatus.CLEAN, 3L));
        assertThat(download.signedGetUrl().getHost()).isEqualTo("storage.example.test");
        verify(minio, never()).getPresignedObjectUrl(any());
        verify(publicSigner, never()).statObject(any());
    }

    @Test
    void scannerFailureRemainsQuarantinedForRetryAndNeverProducesDownloadAuthority() throws Exception {
        AttachmentScanner failing = request -> { throw new IllegalStateException("scanner down"); };
        var failingService = new ConsultationAttachmentStorageService(minio, failing, leases, audit);
        UUID threadId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        String hash = sha256(jpeg);
        var intent = failingService.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
                threadId, UUID.randomUUID(), "image/jpeg", jpeg.length, hash, null));
        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn((long) jpeg.length).when(stat).size();
        doReturn("image/jpeg").when(stat).contentType();
        doReturn(stat).when(minio).statObject(any());
        doReturn(new GetObjectResponse(
                Headers.of(), "healthcare-files", "us-east-1", intent.privateObjectKey(),
                new ByteArrayInputStream(jpeg))).when(minio).getObject(any());
        var result = failingService.complete(new ConsultationAttachmentStorage.CompletionRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(), "image/jpeg", jpeg.length, hash));
        assertThat(result.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.PENDING);
        assertThat(result.failureCode()).isEqualTo("ATTACHMENT_SCANNER_FAILED");
        assertThat(failingService.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(), result.scanStatus(), (long) jpeg.length))
                .signedGetUrl()).isNull();
        verify(audit, never()).onScanRejected(any());
    }

    @Test
    void verifiedPromotionFailureNeverReturnsClean() throws Exception {
        UUID threadId = UUID.randomUUID();
        byte[] jpeg = jpegBytes();
        String hash = sha256(jpeg);
        var intent = service.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
                threadId, UUID.randomUUID(), "image/jpeg", jpeg.length, hash, null));
        StatObjectResponse stat = mock(StatObjectResponse.class);
        doReturn((long) jpeg.length).when(stat).size();
        doReturn("image/jpeg").when(stat).contentType();
        doReturn(stat).when(minio).statObject(any());
        doReturn(new GetObjectResponse(
                Headers.of(), "healthcare-files", "us-east-1", intent.privateObjectKey(),
                new ByteArrayInputStream(jpeg))).when(minio).getObject(any());
        doThrow(new IllegalStateException("object store unavailable"))
                .when(minio).putObject(any());

        var result = service.complete(new ConsultationAttachmentStorage.CompletionRequest(
                threadId, intent.attachmentId(), intent.privateObjectKey(),
                "image/jpeg", jpeg.length, hash));

        assertThat(result.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.PENDING);
        assertThat(result.failureCode()).isEqualTo("ATTACHMENT_VERIFIED_PROMOTION_FAILED");
        verify(audit, never()).onScanRejected(any());
        verify(audit, never()).onScanCompleted(any());
    }

    private byte[] jpegBytes() {
        return new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00, 0x01};
    }

    private String sha256(byte[] bytes) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
