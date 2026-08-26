package com.healthcare.notification;

import com.healthcare.notification.dto.NotificationPreferencePatchRequest;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationPreferenceServiceTest {
    @Test
    void mandatorySecurityPreferenceCannotBeDisabled() {
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        when(users.existsById(userId)).thenReturn(true);
        when(preferences.findById(any())).thenReturn(Optional.of(new NotificationPreference()));

        NotificationPreferenceService service = new NotificationPreferenceService(preferences, users);
        assertThrows(RuntimeException.class, () -> service.patch(userId, NotificationCategory.SECURITY,
            NotificationChannel.EMAIL, new NotificationPreferencePatchRequest(false, null, null, null)));
    }

    @Test
    void listMaterializesDefaultsForUsersCreatedAfterMigration() {
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        when(users.existsById(userId)).thenReturn(true);
        when(preferences.findByIdUserIdOrderByIdCategoryAscIdChannelAsc(userId)).thenReturn(java.util.List.of());

        NotificationPreferenceService service = new NotificationPreferenceService(preferences, users);
        assertThat(service.list(userId)).isEmpty();
        verify(preferences).ensureDefaults(userId);
    }

    @Test
    void invalidTimezoneIsRejectedWithoutPersistingPreference() {
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        when(users.existsById(userId)).thenReturn(true);
        NotificationPreference stored = new NotificationPreference();
        stored.setId(new com.healthcare.notification.entity.NotificationPreferenceId(
            userId, NotificationCategory.CARE_PLAN, NotificationChannel.EMAIL));
        when(preferences.findById(any())).thenReturn(Optional.of(stored));

        NotificationPreferenceService service = new NotificationPreferenceService(preferences, users);
        assertThrows(RuntimeException.class, () -> service.patch(userId, NotificationCategory.CARE_PLAN,
            NotificationChannel.EMAIL, new NotificationPreferencePatchRequest(true, null, null, "not/a-zone")));
        org.mockito.Mockito.verify(preferences, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void clearQuietHoursExplicitlyRemovesExistingWindow() {
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UserRepository users = mock(UserRepository.class);
        UUID userId = UUID.randomUUID();
        when(users.existsById(userId)).thenReturn(true);
        NotificationPreference stored = new NotificationPreference();
        stored.setId(new com.healthcare.notification.entity.NotificationPreferenceId(
            userId, NotificationCategory.CARE_PLAN, NotificationChannel.EMAIL));
        stored.setQuietHoursStart(java.time.LocalTime.of(22, 0));
        stored.setQuietHoursEnd(java.time.LocalTime.of(7, 0));
        when(preferences.findById(any())).thenReturn(Optional.of(stored));
        when(preferences.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationPreferenceService service = new NotificationPreferenceService(preferences, users);
        service.patch(userId, NotificationCategory.CARE_PLAN, NotificationChannel.EMAIL,
            new NotificationPreferencePatchRequest(null, null, null, null, true));

        assertThat(stored.getQuietHoursStart()).isNull();
        assertThat(stored.getQuietHoursEnd()).isNull();
    }
}
