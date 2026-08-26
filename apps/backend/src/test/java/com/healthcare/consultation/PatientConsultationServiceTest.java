package com.healthcare.consultation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.time.OffsetDateTime;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonProperty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PatientConsultationServiceTest {
    private JdbcTemplate jdbc;
    private PatientConsultationService service;
    private UserRepository users;
    private UserDetails principal;
    private UUID userId;

    @BeforeEach
    void setup() {
        jdbc = mock(JdbcTemplate.class);
        users = mock(UserRepository.class);
        principal = mock(UserDetails.class);
        userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        service = new PatientConsultationService(jdbc, users);
    }

    @Test
    void messageRequiresIdempotencyKeyAfterOwnerCheck() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);

        assertThatThrownBy(() -> service.send(threadId,
            new ConsultationContracts.MessageRequest("Xin bác sĩ tư vấn"), null, principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("IDEMPOTENCY_KEY_REQUIRED");
    }

    @Test
    void invalidAttachmentMimeFailsClosed() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);

        var request = new ConsultationContracts.AttachmentIntentRequest(
            UUID.randomUUID(), "text/html", 100L, "a".repeat(64),
            "private/consultations/synthetic/file.html");
        assertThatThrownBy(() -> service.attachmentIntent(threadId, request, principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_ATTACHMENT_INVALID");
    }

    @Test
    void crossOwnerThreadIsIndistinguishableFromMissing() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class)))
            .thenThrow(new EmptyResultDataAccessException(1));

        assertThatThrownBy(() -> service.messages(threadId, principal, 20))
            .isInstanceOf(ResourceNotFoundException.class)
            .extracting("code").isEqualTo("CONSULTATION_NOT_FOUND");
    }

    @Test
    void participantReadRequiresAnActiveMembership() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class)))
            .thenThrow(new EmptyResultDataAccessException(1));

        assertThatThrownBy(() -> service.messages(threadId, principal, 20))
            .isInstanceOf(ResourceNotFoundException.class)
            .extracting("code").isEqualTo("CONSULTATION_NOT_FOUND");

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(sql.capture(), eq(UUID.class), any(Object[].class));
        assertThat(sql.getValue()).containsIgnoringCase("left_at IS NULL");
    }

    @Test
    void patientListRequiresAnActiveMembership() {
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class)))
            .thenReturn(List.of());

        service.listForPatient(principal);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));
        assertThat(sql.getValue()).containsIgnoringCase("left_at IS NULL");
    }

    @Test
    void adminQueueSerializationContainsOnlyOperationalMetadata() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-25T10:15:30+07:00");
        var item = new ConsultationContracts.AdminQueueItem(
            UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "WAITING_FOR_DOCTOR", now.plusHours(2), null, now.plusDays(30), now,
            "noi-tiet", "HANDOFF_DOCTOR", "METADATA_ONLY", now.minusMinutes(5));

        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(item);
        ArrayList<String> fields = new ArrayList<>();
        json.fieldNames().forEachRemaining(fields::add);

        assertThat(fields).containsExactlyInAnyOrder(
            "threadId", "status", "firstResponseDueAt", "firstRespondedAt",
            "consultationOpenUntil", "updatedAt", "specialtySlug",
            "assignmentRole", "assignmentPermission", "assignedAt");
        assertThat(json.toString().toLowerCase()).doesNotContain(
            "subject", "body", "attachment", "appointmentid", "patient",
            "userid", "doctorid", "doctorname", "email", "phone");
    }

    @Test
    void adminQueueSqlNeverReadsTranscriptOrIdentityColumns() {
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class)))
            .thenReturn(List.of());

        service.listForAdmin();

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(org.springframework.jdbc.core.RowMapper.class));
        assertThat(sql.getValue().toLowerCase()).doesNotContain(
            "t.subject", "patient_profile_id", "user_id", "full_name", "email",
            "phone", "patient_consultation_messages", "patient_consultation_attachments");
    }

    @Test
    void sendRejectsClosedWindowBeforeAllocatingSequence() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT status, consultation_open_until"), eq(threadId)))
            .thenReturn(Map.of("status", "CLOSED", "consultation_open_until", OffsetDateTime.now().minusDays(1)));

        assertThatThrownBy(() -> service.send(threadId,
            new ConsultationContracts.MessageRequest("Tin nhắn sau khi đóng"), "retry-key", principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_WINDOW_CLOSED");
        verify(jdbc, never()).update(contains("INSERT INTO patient_consultation_messages"), any(Object[].class));
    }

    @Test
    void browserCannotMarkAttachmentClean() {
        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(attachmentId), eq(threadId)))
            .thenReturn(attachmentRow("PENDING", "REQUESTED",
                "private/consultations/upload-key", "image/jpeg"));

        assertThatThrownBy(() -> service.completeAttachment(threadId, attachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(true), principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE");
        verify(jdbc, never()).update(contains("SET actual_mime_type = ?"), any(Object[].class));
    }

    @Test
    void terminalCompletionIsIdempotentAndNeverRescans() {
        UUID threadId = UUID.randomUUID();
        UUID cleanAttachmentId = UUID.randomUUID();
        UUID rejectedAttachmentId = UUID.randomUUID();
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        when(storage.isEnabled()).thenReturn(true);
        service = serviceWithStorage(storage);
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(cleanAttachmentId), eq(threadId)))
            .thenReturn(attachmentRow("CLEAN", "UPLOADED",
                "private/consultations/verified-key", "image/jpeg"));
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(rejectedAttachmentId), eq(threadId)))
            .thenReturn(attachmentRow("REJECTED", "REJECTED",
                "private/consultations/upload-key", "image/jpeg"));

        var clean = service.completeAttachment(threadId, cleanAttachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(true), principal);
        var rejected = service.completeAttachment(threadId, rejectedAttachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(true), principal);

        assertThat(clean.scanStatus()).isEqualTo("CLEAN");
        assertThat(rejected.scanStatus()).isEqualTo("REJECTED");
        verify(storage, never()).complete(any());
        verify(jdbc).queryForMap(argThat(sql -> sql.contains("SELECT actual_mime_type")
            && !sql.contains("FOR UPDATE")), eq(cleanAttachmentId), eq(threadId));
        verify(jdbc).queryForMap(argThat(sql -> sql.contains("SELECT actual_mime_type")
            && !sql.contains("FOR UPDATE")), eq(rejectedAttachmentId), eq(threadId));
    }

    @Test
    void completionOnlyQueuesHeadVerifiedUploadAndNeverCallsScanner() {
        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        String uploadKey = "private/consultations/upload-key";
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        when(storage.isEnabled()).thenReturn(true);
        when(storage.isUploadPresent(any())).thenReturn(true);
        service = serviceWithStorage(storage);
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(attachmentId), eq(threadId)))
            .thenReturn(attachmentRow("PENDING", "REQUESTED", uploadKey, null));
        when(jdbc.update(contains("UPDATE patient_consultation_attachments"), any(Object[].class)))
            .thenReturn(1);

        var result = service.completeAttachment(threadId, attachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(false), principal);

        assertThat(result.scanStatus()).isEqualTo("PENDING");
        assertThat(result.uploadStatus()).isEqualTo("UPLOADED");
        verify(storage).isUploadPresent(any());
        verify(storage, never()).complete(any());
        verify(storage, never()).scanWithLease(any(), any());
        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), eq(attachmentId), eq(threadId), eq(uploadKey));
        assertThat(sql.getValue()).contains(
            "scan_status = 'PENDING'", "private_object_key = ?", "scan_available_at = statement_timestamp()",
            "upload_expires_at > statement_timestamp()");
        assertThat(sql.getValue()).doesNotContain("FOR UPDATE", "CLEAN", "SET private_object_key", "scan_lease_token =");
    }

    @Test
    void inProgressCompletionNeverWritesPendingState() {
        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        String uploadKey = "private/consultations/upload-key";
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        when(storage.isEnabled()).thenReturn(true);
        service = serviceWithStorage(storage);
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(attachmentId), eq(threadId)))
            .thenReturn(attachmentRow("PENDING", "UPLOADED", uploadKey, null));

        var result = service.completeAttachment(threadId, attachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(false), principal);

        assertThat(result.scanStatus()).isEqualTo("PENDING");
        verify(storage, never()).complete(any());
        verify(storage, never()).isUploadPresent(any());
        verify(jdbc, never()).update(contains("UPDATE patient_consultation_attachments"),
            any(Object[].class));
    }

    @Test
    void casLossReturnsConcurrentTerminalStateWithoutRegressionEvent() {
        UUID threadId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();
        String uploadKey = "private/consultations/upload-key";
        String verifiedKey = "private/consultations/verified-key";
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        when(storage.isEnabled()).thenReturn(true);
        when(storage.isUploadPresent(any())).thenReturn(true);
        service = serviceWithStorage(storage);
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(attachmentId), eq(threadId)))
            .thenReturn(
                attachmentRow("PENDING", "REQUESTED", uploadKey, null),
                attachmentRow("CLEAN", "UPLOADED", verifiedKey, "image/jpeg"));
        when(jdbc.update(contains("UPDATE patient_consultation_attachments"), any(Object[].class)))
            .thenReturn(0);

        var result = service.completeAttachment(threadId, attachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(false), principal);

        assertThat(result.scanStatus()).isEqualTo("CLEAN");
        verify(jdbc, times(2)).queryForMap(argThat(sql -> sql.contains("SELECT actual_mime_type")
            && !sql.contains("FOR UPDATE")), eq(attachmentId), eq(threadId));
        verify(jdbc, never()).update(contains("INSERT INTO patient_consultation_events"),
            any(Object[].class));
    }

    @Test
    void inProgressAppointmentCannotOpenConsultationThread() {
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForMap(anyString(), eq(appointmentId), eq(userId)))
            .thenReturn(Map.of(
                "status", "IN_PROGRESS",
                "appointment_time", OffsetDateTime.now(),
                "patient_id", UUID.randomUUID(),
                "doctor_id", UUID.randomUUID()
            ));

        var request = new ConsultationContracts.CreateRequest(
            appointmentId,
            "Trao đổi sau buổi khám",
            true,
            "consultation-v1"
        );

        assertThatThrownBy(() -> service.create(request, principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_APPOINTMENT_NOT_ELIGIBLE");
        verify(jdbc, never()).update(contains("INSERT INTO patient_consultation_threads"), any(Object[].class));
    }

    @Test
    void reusedIdempotencyKeyWithDifferentBodyFailsBeforeWindowLock() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT id, author_user_id, author_role_snapshot, body"),
            eq(threadId), eq(userId), eq("same-key")))
            .thenReturn(Map.of("id", UUID.randomUUID(), "author_user_id", userId,
                "author_role_snapshot", "PATIENT", "body", "Nội dung cũ",
                "created_at", OffsetDateTime.now()));

        assertThatThrownBy(() -> service.send(threadId,
            new ConsultationContracts.MessageRequest("Nội dung mới"), "same-key", principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_IDEMPOTENCY_CONFLICT");
        verify(jdbc, never()).queryForMap(contains("SELECT status, consultation_open_until"), any(Object[].class));
    }

    @Test
    void messageLimitIsStrictlyBoundedRatherThanSilentlyClamped() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);

        assertThatThrownBy(() -> service.messages(threadId, principal, 101))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_LIMIT_INVALID");
    }

    @Test
    void malformedCursorFailsClosedBeforeQueryingMessages() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);

        assertThatThrownBy(() -> service.messages(threadId, principal, "not-a-cursor", 20))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CONSULTATION_CURSOR_INVALID");
        verify(jdbc, never()).query(contains("ORDER BY m.sequence_number"), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));
    }

    @Test
    void readRequestUsesThroughMessageIdAndKeepsLegacyAccessor() {
        UUID messageId = UUID.randomUUID();
        var request = new ConsultationContracts.ReadRequest(messageId);
        assertThat(request.throughMessageId()).isEqualTo(messageId);
        assertThat(request.lastReadMessageId()).isEqualTo(messageId);
    }

    @Test
    void markReadUsesAtomicMonotonicUpsert() {
        UUID threadId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        UUID remoteAuthorId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT id, sequence_number, author_user_id"), eq(messageId), eq(threadId)))
            .thenReturn(Map.of("id", messageId, "sequence_number", 9L, "author_user_id", remoteAuthorId));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        service.markRead(threadId, new ConsultationContracts.ReadRequest(messageId), principal);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeastOnce()).update(sql.capture(), any(Object[].class));
        assertThat(sql.getAllValues().get(0)).contains(
            "ON CONFLICT (thread_id, user_id) DO UPDATE",
            "COALESCE((",
            "patient_consultation_read_states.last_read_message_id");
        verify(jdbc, never()).queryForMap(contains("COALESCE(m.sequence_number, 0)"),
            any(Object[].class));
    }

    @Test
    void staleReadDoesNotAppendAnotherAuditEvent() {
        UUID threadId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        UUID remoteAuthorId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT id, sequence_number, author_user_id"), eq(messageId), eq(threadId)))
            .thenReturn(Map.of("id", messageId, "sequence_number", 3L, "author_user_id", remoteAuthorId));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);

        service.markRead(threadId, new ConsultationContracts.ReadRequest(messageId), principal);

        verify(jdbc, times(1)).update(contains("ON CONFLICT (thread_id, user_id) DO UPDATE"),
            any(Object[].class));
        verify(jdbc, never()).update(contains("INSERT INTO patient_consultation_events"),
            any(Object[].class));
    }

    @Test
    void ownMessageCannotAdvanceReadWatermarkPastAnUnseenRemoteMessage() {
        UUID threadId = UUID.randomUUID();
        UUID ownMessageId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(threadId);
        when(jdbc.queryForMap(contains("SELECT id, sequence_number, author_user_id"), eq(ownMessageId), eq(threadId)))
            .thenReturn(Map.of("id", ownMessageId, "sequence_number", 12L, "author_user_id", userId));

        service.markRead(threadId, new ConsultationContracts.ReadRequest(ownMessageId), principal);

        verify(jdbc, never()).update(contains("patient_consultation_read_states"), any(Object[].class));
        verify(jdbc, never()).update(contains("INSERT INTO patient_consultation_events"), any(Object[].class));
    }

    @Test
    void reopenAlwaysReturnsToWaitingForDoctor() {
        UUID threadId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(userId);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        service.reopen(threadId, principal);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeastOnce()).update(sql.capture(), any(Object[].class));
        assertThat(sql.getAllValues().stream()
            .filter(statement -> statement.contains("UPDATE patient_consultation_threads t"))
            .findFirst().orElseThrow())
            .contains("SET status = 'WAITING_FOR_DOCTOR'")
            .doesNotContain("author_role_snapshot");
    }

    @Test
    void attachmentRequestDoesNotExposeClientObjectKey() {
        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(
            new ConsultationContracts.AttachmentIntentRequest(
                UUID.randomUUID(), "image/png", 100L, "a".repeat(64), "ignored"));
        assertThat(json.fieldNames()).toIterable().containsExactlyInAnyOrder(
            "messageId", "mimeType", "sizeBytes", "sha256Hash");
        assertThat(json.has("objectKey")).isFalse();
    }

    private PatientConsultationService serviceWithStorage(ConsultationAttachmentStorage storage) {
        @SuppressWarnings("unchecked")
        ObjectProvider<ConsultationAttachmentStorage> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(storage);
        return new PatientConsultationService(jdbc, users, provider);
    }

    private Map<String, Object> attachmentRow(
            String scanStatus, String uploadStatus, String objectKey, String actualMimeType) {
        Map<String, Object> row = new HashMap<>();
        row.put("actual_mime_type", actualMimeType);
        row.put("private_object_key", objectKey);
        row.put("declared_mime_type", "image/jpeg");
        row.put("size_bytes", 100L);
        row.put("sha256_hash", "a".repeat(64));
        row.put("scan_status", scanStatus);
        row.put("upload_status", uploadStatus);
        row.put("upload_expires_at", OffsetDateTime.now().plusMinutes(5));
        row.put("database_now", OffsetDateTime.now());
        row.put("message_id", UUID.randomUUID());
        return row;
    }
}
