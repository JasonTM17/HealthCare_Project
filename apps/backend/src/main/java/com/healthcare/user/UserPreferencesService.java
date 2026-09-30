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

import java.time.DateTimeException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class UserPreferencesService {

    // Shape guard for a BCP-47 style tag; the content guard below pins it to
    // real ISO-639/ISO-3166 codes.
    private static final Pattern LOCALE_TAG_PATTERN =
        Pattern.compile("^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})*$");
    private static final Set<String> ISO_LANGUAGES = Set.of(Locale.getISOLanguages());
    private static final Set<String> ISO_COUNTRIES = Set.of(Locale.getISOCountries());

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
            String locale = request.locale().trim();
            if (!isRealLocaleTag(locale)) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Locale is not a valid language tag");
            }
            preferences.setLocale(locale);
        }
        if (request.timezone() != null) {
            if (request.timezone().isBlank()) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Timezone must not be blank");
            }
            String timezone = request.timezone().trim();
            try {
                ZoneId.of(timezone);
            } catch (DateTimeException ex) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Timezone is not a valid zone identifier");
            }
            preferences.setTimezone(timezone);
        }
        // Bean Validation already pins the chat enums to the supported sets;
        // the blank re-check keeps a bare whitespace patch from storing an
        // unusable default the way locale/timezone are guarded above.
        if (request.chatDefaultMode() != null) {
            if (request.chatDefaultMode().isBlank()) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Chat default mode must not be blank");
            }
            preferences.setChatDefaultMode(request.chatDefaultMode().trim());
        }
        if (request.chatTone() != null) {
            if (request.chatTone().isBlank()) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Chat tone must not be blank");
            }
            preferences.setChatTone(request.chatTone().trim());
        }
        if (request.chatPersonalized() != null) {
            preferences.setChatPersonalized(request.chatPersonalized());
        }
        preferences.setUpdatedAt(OffsetDateTime.now());
        return toResponse(preferencesRepository.save(preferences));
    }

    /**
     * Locale.forLanguageTag accepts any well-formed tag, so syntax alone
     * would still persist junk like 'xx-XX' (observed in production). The
     * language and region must be real ISO codes; vi-VN and en-US pass.
     */
    private static boolean isRealLocaleTag(String value) {
        if (!LOCALE_TAG_PATTERN.matcher(value).matches()) {
            return false;
        }
        Locale locale = Locale.forLanguageTag(value);
        if (locale.getLanguage().isEmpty() || !ISO_LANGUAGES.contains(locale.getLanguage())) {
            return false;
        }
        return locale.getCountry().isEmpty() || ISO_COUNTRIES.contains(locale.getCountry());
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
            preferences.getChatDefaultMode(),
            preferences.getChatTone(),
            preferences.isChatPersonalized(),
            preferences.getUpdatedAt()
        );
    }
}
