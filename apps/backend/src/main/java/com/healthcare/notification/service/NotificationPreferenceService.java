package com.healthcare.notification.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.notification.dto.NotificationPreferencePatchRequest;
import com.healthcare.notification.dto.NotificationPreferenceResponse;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.DateTimeException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class NotificationPreferenceService {
    private static final Set<String> ALLOWED_TIMEZONES = Set.of(
        "Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo",
        "Australia/Sydney", "Europe/London", "America/New_York", "America/Los_Angeles"
    );
    private final NotificationPreferenceRepository repository;
    private final UserRepository users;

    public NotificationPreferenceService(NotificationPreferenceRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    @Transactional
    public List<NotificationPreferenceResponse> list(UUID userId) {
        ensureUser(userId);
        repository.ensureDefaults(userId);
        return repository.findByIdUserIdOrderByIdCategoryAscIdChannelAsc(userId).stream().map(this::toResponse).toList();
    }

    /** Materializes safe defaults for accounts created after V45 as well. */
    @Transactional
    public void ensureDefaultsForUser(UUID userId) {
        ensureUser(userId);
        repository.ensureDefaults(userId);
    }

    @Transactional
    public NotificationPreferenceResponse patch(UUID userId, NotificationCategory category,
                                                NotificationChannel channel,
                                                NotificationPreferencePatchRequest request) {
        ensureUser(userId);
        repository.ensureDefaults(userId);
        if (category == null || channel == null || request == null) {
            throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Tùy chọn thông báo không hợp lệ");
        }
        NotificationPreference preference = repository.findById(new NotificationPreferenceId(userId, category, channel))
            .orElseGet(() -> create(userId, category, channel));
        // Security and OTP notices cannot be opted out. Appointment/payment
        // transactional updates are also mandatory; quiet hours affect only
        // eligible reminder/marketing workers.
        if (request.enabled() != null) {
            if (!request.enabled() && isMandatory(category)) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Thông báo bảo mật và giao dịch không thể tắt");
            }
            preference.setEnabled(request.enabled());
        }
        if (isMandatory(category)
                && (request.quietHoursStart() != null || request.quietHoursEnd() != null
                    || Boolean.TRUE.equals(request.clearQuietHours()))) {
            throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID,
                "Thông báo bảo mật và giao dịch không hỗ trợ giờ yên tĩnh");
        }
        if (Boolean.TRUE.equals(request.clearQuietHours())) {
            preference.setQuietHoursStart(null);
            preference.setQuietHoursEnd(null);
        } else if (request.quietHoursStart() != null || request.quietHoursEnd() != null) {
            if (request.quietHoursStart() == null || request.quietHoursEnd() == null) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Cần chọn đủ thời gian yên tĩnh");
            }
            preference.setQuietHoursStart(request.quietHoursStart());
            preference.setQuietHoursEnd(request.quietHoursEnd());
        }
        if (request.timezone() != null && !request.timezone().isBlank()) {
            String timezone = request.timezone().trim();
            try {
                ZoneId zone = ZoneId.of(timezone);
                if (!ZoneId.getAvailableZoneIds().contains(zone.getId())) {
                    throw new DateTimeException("Unknown timezone");
                }
            } catch (DateTimeException exception) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Múi giờ không hợp lệ");
            }
            if (!ALLOWED_TIMEZONES.contains(timezone)) {
                throw new BusinessException(400, ErrorCodes.PREFERENCES_INVALID, "Múi giờ chưa được hỗ trợ");
            }
            preference.setTimezone(timezone);
        }
        preference.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(preference));
    }

    private NotificationPreference create(UUID userId, NotificationCategory category, NotificationChannel channel) {
        OffsetDateTime now = OffsetDateTime.now();
        NotificationPreference value = new NotificationPreference();
        value.setId(new NotificationPreferenceId(userId, category, channel));
        value.setEnabled(!isMarketing(category));
        value.setCreatedAt(now);
        value.setUpdatedAt(now);
        return value;
    }

    private void ensureUser(UUID userId) {
        if (!users.existsById(userId)) throw new BusinessException(404, ErrorCodes.RESOURCE_NOT_FOUND, "Không tìm thấy tài khoản");
    }
    private static boolean isMarketing(NotificationCategory category) { return category == NotificationCategory.MARKETING; }
    private static boolean isMandatory(NotificationCategory category) {
        return Arrays.asList(NotificationCategory.SECURITY, NotificationCategory.APPOINTMENT,
            NotificationCategory.PAYMENT).contains(category);
    }
    private NotificationPreferenceResponse toResponse(NotificationPreference value) {
        return new NotificationPreferenceResponse(value.getCategory(), value.getChannel(), value.isEnabled(),
            value.getQuietHoursStart(), value.getQuietHoursEnd(), value.getTimezone());
    }
}
