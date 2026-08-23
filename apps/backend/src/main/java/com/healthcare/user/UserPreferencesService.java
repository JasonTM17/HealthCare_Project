package com.healthcare.user;

import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.BusinessException;
import com.healthcare.user.dto.UserPreferencesPatchRequest;
import com.healthcare.user.dto.UserPreferencesResponse;
import com.healthcare.user.entity.User;
import com.healthcare.user.entity.UserPreferences;
import com.healthcare.user.repository.UserPreferencesRepository;
import com.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class UserPreferencesService {

    private final UserRepository userRepository;
    private final UserPreferencesRepository preferencesRepository;

    public UserPreferencesService(UserRepository userRepository,
                                  UserPreferencesRepository preferencesRepository) {
        this.userRepository = userRepository;
        this.preferencesRepository = preferencesRepository;
    }

    @Transactional
    public UserPreferencesResponse get(UUID userId) {
        return toResponse(getOrCreate(userId));
    }

    @Transactional
    public UserPreferencesResponse patch(UUID userId, UserPreferencesPatchRequest request) {
        if (request == null) {
            throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Preferences payload is required");
        }
        UserPreferences preferences = getOrCreate(userId);
        if (request.emailNotifications() != null) {
            preferences.setEmailNotifications(request.emailNotifications());
        }
        if (request.appointmentReminders() != null) {
            preferences.setAppointmentReminders(request.appointmentReminders());
        }
        if (request.marketingEmails() != null) {
            preferences.setMarketingEmails(request.marketingEmails());
        }
        if (request.locale() != null) {
            if (request.locale().isBlank()) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Locale must not be blank");
            }
            preferences.setLocale(request.locale().trim());
        }
        if (request.timezone() != null) {
            if (request.timezone().isBlank()) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Timezone must not be blank");
            }
            preferences.setTimezone(request.timezone().trim());
        }
        preferences.setUpdatedAt(OffsetDateTime.now());
        return toResponse(preferencesRepository.save(preferences));
    }

    private UserPreferences getOrCreate(UUID userId) {
        return preferencesRepository.findById(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(
                    404, ErrorCodes.RESOURCE_NOT_FOUND, "User not found"
                ));
            OffsetDateTime now = OffsetDateTime.now();
            UserPreferences preferences = new UserPreferences();
            preferences.setUser(user);
            preferences.setCreatedAt(now);
            preferences.setUpdatedAt(now);
            return preferencesRepository.save(preferences);
        });
    }

    private UserPreferencesResponse toResponse(UserPreferences preferences) {
        return new UserPreferencesResponse(
            preferences.isEmailNotifications(),
            preferences.isAppointmentReminders(),
            preferences.isMarketingEmails(),
            preferences.getLocale(),
            preferences.getTimezone(),
            preferences.getUpdatedAt()
        );
    }
}
