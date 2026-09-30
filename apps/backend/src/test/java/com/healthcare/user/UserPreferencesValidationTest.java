package com.healthcare.user;

import com.healthcare.exception.BusinessException;
import com.healthcare.user.dto.UserPreferencesPatchRequest;
import com.healthcare.user.dto.UserPreferencesResponse;
import com.healthcare.user.entity.UserPreferences;
import com.healthcare.user.repository.UserPreferencesRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain-unit guard for the locale/timezone hygiene fix: the service must
 * reject syntactically well-formed but non-existent tags (the production
 * probe persisted locale='xx-XX') and zone ids ZoneId cannot parse, and
 * must persist nothing on rejection. Shape follows PatientConsultationServiceTest.
 */
class UserPreferencesValidationTest {

    private UserPreferencesRepository preferencesRepository;
    private UserPreferencesService service;
    private UUID userId;

    @BeforeEach
    void setup() {
        preferencesRepository = mock(UserPreferencesRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        userId = UUID.randomUUID();
        when(preferencesRepository.findById(userId)).thenReturn(Optional.of(new UserPreferences()));
        when(preferencesRepository.save(any(UserPreferences.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        service = new UserPreferencesService(userRepository, preferencesRepository);
    }

    private UserPreferencesPatchRequest request(String locale, String timezone) {
        return new UserPreferencesPatchRequest(null, null, null, locale, timezone, null, null, null);
    }

    @Test
    void nonExistentLocaleTagIsRejectedAndNotPersisted() {
        assertThatThrownBy(() -> service.patch(userId, request("xx-XX", "Asia/Ho_Chi_Minh")))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("PREFERENCES_INVALID");
        verify(preferencesRepository, never()).save(any(UserPreferences.class));
    }

    @Test
    void unparseableTimezoneIsRejectedAndNotPersisted() {
        assertThatThrownBy(() -> service.patch(userId, request("vi-VN", "Not/AZone!!")))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("PREFERENCES_INVALID");
        verify(preferencesRepository, never()).save(any(UserPreferences.class));
    }

    @Test
    void blankLocaleAndTimezoneKeepTheirExistingGuards() {
        assertThatThrownBy(() -> service.patch(userId, request("  ", "Asia/Ho_Chi_Minh")))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("PREFERENCES_INVALID");
        assertThatThrownBy(() -> service.patch(userId, request("vi-VN", " ")))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("PREFERENCES_INVALID");
    }

    @Test
    void realTagsSentByTheFrontendArePersisted() {
        UserPreferencesResponse response = service.patch(userId, request("vi-VN", "Asia/Ho_Chi_Minh"));

        assertThat(response.locale()).isEqualTo("vi-VN");
        assertThat(response.timezone()).isEqualTo("Asia/Ho_Chi_Minh");
        verify(preferencesRepository).save(any(UserPreferences.class));
    }
}
