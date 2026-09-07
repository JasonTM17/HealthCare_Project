package com.healthcare.notification.service;

import com.healthcare.common.SafePageRequests;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.notification.dto.NotificationResponse;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private static final Set<String> ALLOWED_SORT_PROPERTIES =
        Set.of("id", "title", "createdAt", "readAt", "read");

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository preferenceRepository,
            UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Notification create(UUID userId, EventType eventType, String title, String message, UUID referenceId) {
        User user = userRepository.findById(userId)
            // A recipient vanishing concurrently must not roll back the
            // enclosing business transaction (payment review, clinical
            // result, ...): the notification is a non-essential side effect.
            // Everything else still propagates.
            .orElse(null);
        if (user == null) {
            log.warn("Skipping notification {} for missing user {}", eventType, userId);
            return null;
        }
        if (!channelEnabled(userId, eventType, NotificationChannel.IN_APP)) {
            return null;
        }
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setEventType(eventType);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notification.setEmailAvailableAt(OffsetDateTime.now());
        return notificationRepository.save(notification);
    }

    private boolean channelEnabled(UUID userId, EventType eventType, NotificationChannel channel) {
        NotificationCategory category = categoryFor(eventType);
        if (category == null) {
            return true;
        }
        try {
            preferenceRepository.ensureDefaults(userId);
            return preferenceRepository.findById(new NotificationPreferenceId(userId, category, channel))
                .map(NotificationPreference::isEnabled)
                .orElse(true);
        } catch (RuntimeException exception) {
            log.warn("Skipping notification {} because preference lookup failed ({})",
                eventType, exception.getClass().getSimpleName());
            return false;
        }
    }

    static NotificationCategory categoryFor(EventType eventType) {
        if (eventType == null) {
            return null;
        }
        return switch (eventType) {
            case APPOINTMENT_CREATED, APPOINTMENT_CONFIRMED, APPOINTMENT_RESCHEDULED,
                 APPOINTMENT_CANCELLED, APPOINTMENT_REMINDER -> NotificationCategory.APPOINTMENT;
            case DIAGNOSTIC_RESULT_AVAILABLE -> NotificationCategory.CLINICAL_UPDATE;
            case PAYMENT_SUBMITTED, PAYMENT_CONFIRMED, PAYMENT_REJECTED,
                 PAYMENT_REFUNDED -> NotificationCategory.PAYMENT;
            case CARE_PLAN_CREATED, CARE_PLAN_ITEM_COMPLETED,
                 CARE_PLAN_ITEM_CANCELLED -> NotificationCategory.CARE_PLAN;
        };
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> listForUser(UserDetails principal, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(
                resolveUser(principal).getId(),
                SafePageRequests.normalize(pageable, Sort.by(Sort.Direction.DESC, "createdAt"), ALLOWED_SORT_PROPERTIES))
            .map(NotificationResponse::from);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UserDetails principal) {
        UUID userId = resolveUser(principal).getId();
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!notification.getUser().getId().equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException("Cannot access this notification");
        }
        notification.setRead(true);
        notification.setReadAt(OffsetDateTime.now());
        notificationRepository.save(notification);
    }

    @Transactional
    public int markAllAsRead(UserDetails principal) {
        return notificationRepository.markAllAsRead(resolveUser(principal).getId(), OffsetDateTime.now());
    }
}
