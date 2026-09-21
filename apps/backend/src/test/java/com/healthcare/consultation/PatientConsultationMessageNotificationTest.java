package com.healthcare.consultation;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plan outcome: the counterpart in a consultation thread learns that a message
 * arrived.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code AdminAppointmentCancelTest}: {@code send()} is a fixed sequence of
 * JdbcTemplate statements, so the stubs below replay that sequence and the
 * assertion is the recipient the notification is addressed to. The author never
 * receives their own ping, and the message body is never quoted.
 */
class PatientConsultationMessageNotificationTest {

    private static final String AUTHOR_EMAIL = "patient@example.test";
    private static final UUID AUTHOR_ID = UUID.fromString("11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID PATIENT_USER_ID = UUID.fromString("22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID DOCTOR_USER_ID = UUID.fromString("33333333-cccc-cccc-cccc-cccccccccccc");
    private static final String MESSAGE_BODY = "Bác sĩ ơi, tôi nên uống thuốc này khi nào?";

    private JdbcTemplate jdbc;
    private NotificationService notifications;
    private PatientConsultationService service;
    private UserDetails principal;
    private UUID threadId;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void wireService() {
        jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        notifications = mock(NotificationService.class);
        ObjectProvider<ConsultationAttachmentStorage> storage = mock(ObjectProvider.class);
        when(storage.getIfAvailable()).thenReturn(null);

        User author = new User();
        author.setId(AUTHOR_ID);
        principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn(AUTHOR_EMAIL);
        when(users.findByEmail(AUTHOR_EMAIL)).thenReturn(Optional.of(author));

        threadId = UUID.fromString("44444444-dddd-dddd-dddd-dddddddddddd");
        OffsetDateTime now = OffsetDateTime.now();

        // The thread lock read: an open window, on database time.
        Map<String, Object> openThread = new HashMap<>();
        openThread.put("status", "WAITING_FOR_DOCTOR");
        openThread.put("consultation_open_until", now.plusDays(7));
        openThread.put("database_now", now);
        when(jdbc.queryForMap(contains("SELECT status, consultation_open_until"), eq(threadId)))
            .thenReturn(openThread);

        // The idempotency probe and the post-insert fetch share this statement
        // text, so the first two calls report "no replay yet" and the third
        // returns the row the message insert produced.
        Map<String, Object> storedMessage = new HashMap<>();
        storedMessage.put("id", UUID.fromString("55555555-eeee-eeee-eeee-eeeeeeeeeeee"));
        storedMessage.put("author_user_id", AUTHOR_ID);
        storedMessage.put("author_role_snapshot", "PATIENT");
        storedMessage.put("body", MESSAGE_BODY);
        storedMessage.put("created_at", now);
        when(jdbc.queryForMap(
            contains("SELECT id, author_user_id, author_role_snapshot, body"),
            eq(threadId), eq(AUTHOR_ID), eq("msg-key-1")))
            .thenReturn(Map.of(), Map.of(), storedMessage);

        Map<String, Object> threadOwners = new HashMap<>();
        threadOwners.put("patient_user_id", PATIENT_USER_ID);
        threadOwners.put("doctor_user_id", DOCTOR_USER_ID);
        when(jdbc.queryForMap(contains("SELECT p.user_id AS patient_user_id"), eq(threadId)))
            .thenReturn(threadOwners);

        service = new PatientConsultationService(jdbc, users, storage, notifications);
    }

    @Test
    @DisplayName("A message the patient writes pings the assigned doctor, not the author")
    void patientMessageNotifiesDoctor() {
        service.send(threadId, new ConsultationContracts.MessageRequest(MESSAGE_BODY), "msg-key-1", principal);

        verify(notifications).create(
            eq(DOCTOR_USER_ID),
            eq(EventType.CONSULTATION_MESSAGE),
            eq("Có tin nhắn tư vấn mới"),
            eq("Kênh tư vấn của bạn có tin nhắn mới. Vào mục Tư vấn để xem và trả lời."),
            eq(threadId));
    }

    @Test
    @DisplayName("A reply the doctor writes pings the patient instead")
    void doctorReplyNotifiesPatient() {
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(true);

        service.send(threadId, new ConsultationContracts.MessageRequest(MESSAGE_BODY), "msg-key-1", principal);

        verify(notifications).create(
            eq(PATIENT_USER_ID),
            eq(EventType.CONSULTATION_MESSAGE),
            eq("Có tin nhắn tư vấn mới"),
            anyString(),
            eq(threadId));
    }
}
