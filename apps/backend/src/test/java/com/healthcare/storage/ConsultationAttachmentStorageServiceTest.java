package com.healthcare.storage;

import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.AttachmentScanLeaseStore;
import com.healthcare.storage.service.AttachmentScanner;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.storage.service.ConsultationAttachmentStorageService;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ConsultationAttachmentStorageServiceTest {

    @Test
    void disabledProviderNeverReturnsUploadAuthority() {
        ConsultationAttachmentStorageService service = new ConsultationAttachmentStorageService(
            null, mock(AttachmentScanner.class), mock(AttachmentScanLeaseStore.class),
            mock(AttachmentScanAuditHook.class));

        var result = service.createUploadIntent(new ConsultationAttachmentStorage.UploadIntentRequest(
            UUID.randomUUID(), UUID.randomUUID(), "image/jpeg", 128, "a".repeat(64), null));

        assertThat(result.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.DISABLED);
        assertThat(result.signedPutUrl()).isNull();
        assertThat(result.privateObjectKey()).isNull();
    }

    @Test
    void forgedObjectKeyIsRejectedBeforeObjectStoreAccess() {
        MinioClient minio = mock(MinioClient.class);
        ConsultationAttachmentStorageService service = new ConsultationAttachmentStorageService(
            minio, request -> AttachmentScanner.ScanResult.clean(), mock(AttachmentScanLeaseStore.class),
            mock(AttachmentScanAuditHook.class));
        UUID thread = UUID.randomUUID();
        UUID attachment = UUID.randomUUID();

        var result = service.complete(new ConsultationAttachmentStorage.CompletionRequest(
            thread, attachment, "private/consultations/" + thread + "/" + attachment + "/forged.sig",
            "image/jpeg", 10, "b".repeat(64)));

        assertThat(result.scanStatus()).isEqualTo(ConsultationAttachmentStorage.ScanStatus.REJECTED);
        assertThat(result.failureCode()).isEqualTo("ATTACHMENT_OBJECT_KEY_FORGED");
    }

    @Test
    void downloadRequiresPersistedCleanState() {
        ConsultationAttachmentStorageService service = new ConsultationAttachmentStorageService(
            mock(MinioClient.class), request -> AttachmentScanner.ScanResult.clean(),
            mock(AttachmentScanLeaseStore.class), mock(AttachmentScanAuditHook.class));

        var result = service.issueDownloadUrl(new ConsultationAttachmentStorage.DownloadRequest(
            UUID.randomUUID(), UUID.randomUUID(), "private/consultations/not-a-key",
            ConsultationAttachmentStorage.ScanStatus.PENDING, 10L));

        assertThat(result.availability()).isEqualTo(ConsultationAttachmentStorage.Availability.DISABLED);
        assertThat(result.failureCode()).isEqualTo("ATTACHMENT_NOT_CLEAN");
    }
}
