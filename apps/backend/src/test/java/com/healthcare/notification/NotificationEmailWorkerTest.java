package com.healthcare.notification;

import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.notification.service.NotificationEmailWorker;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationEmailWorkerTest {

    @Test
    void queuesSystemNotificationEmailWithStableIdempotencyKey() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        OffsetDateTime now = OffsetDateTime.parse("2026-09-07T02:00:00Z");
        Notification notification = notification(EventType.DIAGNOSTIC_RESULT_AVAILABLE);
        NotificationPreference preference = preference(
            notification.getUser().getId(), NotificationCategory.CLINICAL_UPDATE, true);
        when(emailSender.isTransactionalOutbox()).thenReturn(true);
        when(notifications.findEmailPendingForUpdate(eq(now), any(Pageable.class)))
            .thenReturn(List.of(notification));
        when(preferences.findById(preference.getId())).thenReturn(Optional.of(preference));

        int decided = worker(notifications, preferences, emailSender, now).enqueueDueNotifications();

        assertThat(decided).isEqualTo(1);
        verify(emailSender).sendSystemNotification(
            eq("patient@example.test"),
            eq("Kết quả mới\n\nBạn có kết quả mới."),
            eq("notification-" + notification.getId()),
            eq(notification.getUser().getId()),
            eq(notification.getReferenceId()),
            eq(EventType.DIAGNOSTIC_RESULT_AVAILABLE.name()),
            eq(86_400L)
        );
        assertThat(notification.getEmailQueuedAt()).isEqualTo(now);
        verify(notifications).save(notification);
    }

    @Test
    void disabledEmailPreferenceSuppressesTheNotificationEmailOnce() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        OffsetDateTime now = OffsetDateTime.parse("2026-09-07T02:00:00Z");
        Notification notification = notification(EventType.DIAGNOSTIC_RESULT_AVAILABLE);
        NotificationPreference preference = preference(
            notification.getUser().getId(), NotificationCategory.CLINICAL_UPDATE, false);
        when(emailSender.isTransactionalOutbox()).thenReturn(true);
        when(notifications.findEmailPendingForUpdate(eq(now), any(Pageable.class)))
            .thenReturn(List.of(notification));
        when(preferences.findById(preference.getId())).thenReturn(Optional.of(preference));

        int decided = worker(notifications, preferences, emailSender, now).enqueueDueNotifications();

        assertThat(decided).isEqualTo(1);
        assertThat(notification.getEmailSuppressedAt()).isEqualTo(now);
        verify(emailSender, never()).sendSystemNotification(
            any(), any(), any(), any(), any(), any(), eq(86_400L));
        verify(notifications).save(notification);
    }

    @Test
    void quietHoursDefersEmailUntilTheWindowEnds() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        OffsetDateTime now = OffsetDateTime.parse("2026-09-07T16:30:00Z");
        Notification notification = notification(EventType.DIAGNOSTIC_RESULT_AVAILABLE);
        NotificationPreference preference = preference(
            notification.getUser().getId(), NotificationCategory.CLINICAL_UPDATE, true);
        preference.setQuietHoursStart(LocalTime.of(22, 0));
        preference.setQuietHoursEnd(LocalTime.of(7, 0));
        preference.setTimezone("Asia/Ho_Chi_Minh");
        when(emailSender.isTransactionalOutbox()).thenReturn(true);
        when(notifications.findEmailPendingForUpdate(eq(now), any(Pageable.class)))
            .thenReturn(List.of(notification));
        when(preferences.findById(preference.getId())).thenReturn(Optional.of(preference));

        int decided = worker(notifications, preferences, emailSender, now).enqueueDueNotifications();

        assertThat(decided).isZero();
        assertThat(notification.getEmailQueuedAt()).isNull();
        assertThat(notification.getEmailAvailableAt())
            .isEqualTo(OffsetDateTime.of(2026, 9, 8, 7, 0, 0, 0, ZoneOffset.ofHours(7)));
        verify(emailSender, never()).sendSystemNotification(
            any(), any(), any(), any(), any(), any(), eq(86_400L));
        verify(notifications).save(notification);
    }

    @Test
    void workerDoesNotMarkRowsWhenTransactionalOutboxIsUnavailable() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        when(emailSender.isTransactionalOutbox()).thenReturn(false);

        int decided = worker(
            notifications, preferences, emailSender, OffsetDateTime.parse("2026-09-07T02:00:00Z"))
            .enqueueDueNotifications();

        assertThat(decided).isZero();
        verify(notifications, never()).findEmailPendingForUpdate(any(), any(Pageable.class));
    }

    private static NotificationEmailWorker worker(
            NotificationRepository notifications,
            NotificationPreferenceRepository preferences,
            AfterCommitEmailSender emailSender,
            OffsetDateTime now) {
        return new NotificationEmailWorker(
            notifications,
            preferences,
            emailSender,
            Clock.fixed(now.toInstant(), ZoneOffset.UTC),
            25
        );
    }

    private static Notification notification(EventType eventType) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("patient@example.test");
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setUser(user);
        notification.setEventType(eventType);
        notification.setTitle("Kết quả mới");
        notification.setMessage("Bạn có kết quả mới.");
        notification.setReferenceId(UUID.randomUUID());
        return notification;
    }

    private static NotificationPreference preference(
            UUID userId,
            NotificationCategory category,
            boolean enabled) {
        NotificationPreference preference = new NotificationPreference();
        preference.setId(new NotificationPreferenceId(userId, category, NotificationChannel.EMAIL));
        preference.setEnabled(enabled);
        preference.setTimezone("Asia/Ho_Chi_Minh");
        return preference;
    }
}
