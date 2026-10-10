package com.healthcare.notification;

import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    @Test
    void demonstrationIsInAppOnlyAndDoesNotMaterializeExistingPreferences() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        var guard = mock(com.healthcare.demo.DashboardDemonstrationGuard.class);
        UUID recipient = com.healthcare.demo.DashboardDemonstration.OWNER_ADMIN;
        UUID reference = com.healthcare.demo.DashboardDemonstration.id("appointment");
        User user = new User();
        user.setId(recipient);
        when(guard.allowNotification(reference, recipient)).thenReturn(true);
        when(users.findById(recipient)).thenReturn(Optional.of(user));
        when(preferences.findById(any())).thenReturn(Optional.empty());
        when(notifications.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Notification result = new NotificationService(notifications, preferences, users, guard).create(
            recipient, EventType.PAYMENT_SUBMITTED, "Chờ kiểm tra", "Mã mô phỏng đã gửi.", reference);

        assertThat(result.getEmailSuppressedAt()).isNotNull();
        assertThat(result.getEmailQueuedAt()).isNull();
        assertThat(result.getTitle()).startsWith("[Minh họa]");
        assertThat(result.getMessage()).contains("không chuyển tiền");
        verify(preferences, never()).ensureDefaults(any());
        verify(guard).allowNotification(reference, recipient);
    }

    @Test
    void demonstrationNeverReadsOrNotifiesUnrelatedRecipient() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        var guard = mock(com.healthcare.demo.DashboardDemonstrationGuard.class);
        UUID recipient = UUID.randomUUID();
        UUID reference = com.healthcare.demo.DashboardDemonstration.id("appointment");

        assertThat(new NotificationService(notifications, preferences, users, guard).create(
            recipient, EventType.PAYMENT_SUBMITTED, "Chờ kiểm tra", "Mã mô phỏng đã gửi.", reference)).isNull();
        org.mockito.Mockito.verifyNoInteractions(users, preferences, notifications);
        verify(guard).allowNotification(reference, recipient);
    }

    @Test
    void demonstrationHonorsAnExistingInAppOptOutWithoutRewritingIt() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        var guard = mock(com.healthcare.demo.DashboardDemonstrationGuard.class);
        UUID recipient = com.healthcare.demo.DashboardDemonstration.OWNER_ADMIN;
        UUID reference = com.healthcare.demo.DashboardDemonstration.id("appointment");
        User user = new User();
        user.setId(recipient);
        NotificationPreference preference = new NotificationPreference();
        preference.setEnabled(false);
        when(guard.allowNotification(reference, recipient)).thenReturn(true);
        when(users.findById(recipient)).thenReturn(Optional.of(user));
        when(preferences.findById(any())).thenReturn(Optional.of(preference));

        assertThat(new NotificationService(notifications, preferences, users, guard).create(
            recipient, EventType.PAYMENT_SUBMITTED, "Chờ kiểm tra", "Mã mô phỏng đã gửi.", reference)).isNull();
        verify(preferences, never()).ensureDefaults(any());
        verify(preferences, never()).save(any());
        verify(notifications, never()).save(any());
    }

    @Test
    void disabledInAppPreferenceSuppressesOptionalNotificationRow() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("patient@example.test");
        NotificationPreference preference = new NotificationPreference();
        preference.setId(new NotificationPreferenceId(
            userId, NotificationCategory.CLINICAL_UPDATE, NotificationChannel.IN_APP));
        preference.setEnabled(false);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(preferences.findById(preference.getId())).thenReturn(Optional.of(preference));

        Notification result = new NotificationService(notifications, preferences, users, mock(com.healthcare.demo.DashboardDemonstrationGuard.class)).create(
            userId,
            EventType.DIAGNOSTIC_RESULT_AVAILABLE,
            "Kết quả mới",
            "Bạn có kết quả mới.",
            UUID.randomUUID()
        );

        assertThat(result).isNull();
        verify(preferences).ensureDefaults(userId);
        verify(notifications, never()).save(any(Notification.class));
    }
}
