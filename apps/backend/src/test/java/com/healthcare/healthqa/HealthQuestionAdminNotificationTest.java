package com.healthcare.healthqa;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plan outcome: "Quản trị viên nhận thông báo khi có câu hỏi mới" — a question
 * enters the moderation queue and the reviewers have to be told.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code AdminAppointmentCancelTest}.
 */
class HealthQuestionAdminNotificationTest {

    private static final String PATIENT_EMAIL = "patient@example.test";
    private static final UUID ADMIN_ONE = UUID.fromString("21212121-1111-1111-1111-111111111111");
    private static final UUID ADMIN_TWO = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    @DisplayName("A new question notifies every active admin through the bounded fan-out")
    void newQuestionNotifiesActiveAdmins() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        UUID patientUserId = UUID.fromString("23232323-3333-3333-3333-333333333333");
        User patient = new User();
        patient.setId(patientUserId);
        UserDetails principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn(PATIENT_EMAIL);
        when(users.findByEmail(PATIENT_EMAIL)).thenReturn(Optional.of(patient));
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class)))
            .thenReturn(UUID.fromString("24242424-4444-4444-4444-444444444444"));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(users.findActiveAdminUserIds(any(Pageable.class))).thenReturn(List.of(ADMIN_ONE, ADMIN_TWO));
        doReturnQueueRow(jdbc);

        new HealthQuestionService(jdbc, users, null, null, notifications)
            .create(new HealthQuestionContracts.CreateRequest(
                "tien-mach", "Tôi hay khát nước và mệt mỏi", "Benh nhan 01"), principal);

        verify(notifications).create(
            eq(ADMIN_ONE), eq(EventType.HEALTH_QUESTION_SUBMITTED), eq("Có câu hỏi sức khỏe mới"),
            anyString(), any(UUID.class));
        verify(notifications).create(
            eq(ADMIN_TWO), eq(EventType.HEALTH_QUESTION_SUBMITTED), eq("Có câu hỏi sức khỏe mới"),
            anyString(), any(UUID.class));
        ArgumentCaptor<Pageable> fanOut = ArgumentCaptor.forClass(Pageable.class);
        verify(users).findActiveAdminUserIds(fanOut.capture());
        assertThat(fanOut.getValue().getPageSize()).isEqualTo(50);
    }

    @Test
    @DisplayName("The moderation queue is silent when no active admin exists")
    void noAdminMeansNoNotification() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        User patient = new User();
        patient.setId(UUID.fromString("25252525-5555-5555-5555-555555555555"));
        UserDetails principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn(PATIENT_EMAIL);
        when(users.findByEmail(PATIENT_EMAIL)).thenReturn(Optional.of(patient));
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class)))
            .thenReturn(UUID.fromString("26262626-6666-6666-6666-666666666666"));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(users.findActiveAdminUserIds(any(Pageable.class))).thenReturn(List.of());
        doReturnQueueRow(jdbc);

        new HealthQuestionService(jdbc, users, null, null, notifications)
            .create(new HealthQuestionContracts.CreateRequest(
                "tien-mach", "Tôi hay khát nước và mệt mỏi", "Benh nhan 01"), principal);

        verify(notifications, never()).create(
            any(UUID.class), any(EventType.class), anyString(), anyString(), any(UUID.class));
    }

    /** The listing read that closes {@code create()}; the row itself is not under test. */
    private void doReturnQueueRow(JdbcTemplate jdbc) {
        HealthQuestionContracts.Summary summary = new HealthQuestionContracts.Summary(
            UUID.randomUUID(), "tien-mach", "Tôi hay khát nước và mệt mỏi", "Benh nhan 01",
            "PENDING_MODERATION", null, null, null);
        org.mockito.Mockito.doReturn(List.of(summary))
            .when(jdbc).query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));
    }
}
