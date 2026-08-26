package com.healthcare.consultation.service;

import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class ConsultationAttachmentScanWorkerTest {

    @Test
    void staleCleanPromotionQueuesUploadAndVerifiedKeysBeforeFencedUpdate() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        ConsultationAttachmentScanWorker worker = new ConsultationAttachmentScanWorker(
            jdbc, storage, transactions, true, 120);

        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        String uploadKey = "private/consultations/" + threadId + "/upload/" + attachmentId;
        String verifiedKey = "private/consultations/" + threadId + "/verified/" + attachmentId;
        var request = new ConsultationAttachmentStorage.CompletionRequest(
            threadId, attachmentId, uploadKey, "image/png", 10, "a".repeat(64));
        var lease = new AttachmentScanAuditHook.ScanLease(
            UUID.randomUUID(), attachmentId, uploadKey, Instant.now(), Instant.now().plusSeconds(120));
        var claim = new ConsultationAttachmentScanWorker.Claim(request, lease, 1);
        var result = new ConsultationAttachmentStorage.CompletionResult(
            ConsultationAttachmentStorage.Availability.ENABLED,
            attachmentId,
            verifiedKey,
            "image/png",
            10,
            "a".repeat(64),
            ConsultationAttachmentStorage.ScanStatus.CLEAN,
            Instant.now(),
            null);

        worker.finish(claim, result);

        verify(jdbc, times(2)).update(contains("patient_consultation_object_cleanup"),
            any(), any(), any());
        verify(jdbc).update(contains("UPDATE patient_consultation_attachments"),
            any(Object[].class));
    }
}
