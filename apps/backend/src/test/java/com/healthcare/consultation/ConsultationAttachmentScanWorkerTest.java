package com.healthcare.consultation.service;

import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;

class ConsultationAttachmentScanWorkerTest {

    @Test
    void staleCleanPromotionRevivesVerifiedCleanupAfterFencedUpdateMisses() {
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

        var order = inOrder(jdbc);
        order.verify(jdbc).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(uploadKey));
        order.verify(jdbc).update(contains("UPDATE patient_consultation_attachments"),
            any(Object[].class));
        order.verify(jdbc).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(verifiedKey));
        verify(jdbc).update(contains("ON CONFLICT (object_key) DO UPDATE"),
            eq(threadId), eq(attachmentId), eq(verifiedKey));
    }

    @Test
    void currentCleanPromotionKeepsVerifiedObjectDownloadable() {
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
            threadId, attachmentId, uploadKey, "image/png", 10, "a".repeat(64), verifiedKey);
        var lease = new AttachmentScanAuditHook.ScanLease(
            UUID.randomUUID(), attachmentId, uploadKey, Instant.now(), Instant.now().plusSeconds(120));
        var claim = new ConsultationAttachmentScanWorker.Claim(request, lease, 1);
        var result = new ConsultationAttachmentStorage.CompletionResult(
            ConsultationAttachmentStorage.Availability.ENABLED, attachmentId, verifiedKey,
            "image/png", 10, "a".repeat(64), ConsultationAttachmentStorage.ScanStatus.CLEAN,
            Instant.now(), null);
        when(jdbc.update(contains("UPDATE patient_consultation_attachments"), any(Object[].class)))
            .thenReturn(1);

        worker.finish(claim, result);

        verify(jdbc).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(uploadKey));
        verify(jdbc, never()).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(verifiedKey));
    }

    @Test
    void expiredUploadQueuesPrivateObjectsBeforeAudit() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        ConsultationAttachmentScanWorker worker = new ConsultationAttachmentScanWorker(
            jdbc, storage, transactions, true, 120);
        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        String uploadKey = "private/consultations/" + threadId + "/upload/upload";
        String staleKey = "private/consultations/" + threadId + "/upload/stale";
        when(jdbc.query(contains("RETURNING a.thread_id"), any(RowMapper.class), any(Integer.class)))
            .thenReturn(List.of(new ConsultationAttachmentScanWorker.ExpiredAttachment(
                threadId, attachmentId, uploadKey, staleKey)));

        worker.expireAbandoned();

        verify(jdbc).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(uploadKey));
        verify(jdbc).update(contains("patient_consultation_object_cleanup"),
            eq(threadId), eq(attachmentId), eq(staleKey));
        verify(jdbc).update(contains("patient_consultation_events"), eq(threadId), eq(attachmentId));
    }
}
