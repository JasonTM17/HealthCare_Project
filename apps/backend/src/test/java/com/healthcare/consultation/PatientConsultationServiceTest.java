package com.healthcare.consultation;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PatientConsultationServiceTest {
    private JdbcTemplate jdbc;
    private PatientConsultationService service;
    private UserDetails principal;
    private UUID userId;

    @BeforeEach
    void setup() {
        jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
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
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForMap(contains("SELECT actual_mime_type"), eq(attachmentId), eq(threadId)))
            .thenReturn(Map.of("actual_mime_type", "image/jpeg", "size_bytes", 100L, "scan_status", "PENDING"));

        var result = service.completeAttachment(threadId, attachmentId,
            new ConsultationContracts.AttachmentCompleteRequest(true), principal);

        org.assertj.core.api.Assertions.assertThat(result.scanStatus()).isEqualTo("PENDING");
        verify(jdbc).update(contains("SET scan_status = 'PENDING'"), eq(attachmentId), eq(threadId));
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
}
