package com.healthcare.notification.service;

import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.mail.EmailDeliverySuppressedException;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.user.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Component
@ConditionalOnProperty(prefix = "app.notification.email", name = "enabled", havingValue = "true")
public class NotificationEmailWorker {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailWorker.class);
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final long EMAIL_TTL_SECONDS = 86_400;

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final AfterCommitEmailSender emailSender;
    private final Clock clock;
    private final int batchSize;

    @Autowired
    public NotificationEmailWorker(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository preferenceRepository,
            AfterCommitEmailSender emailSender,
            @Value("${app.notification.email.batch-size:100}") int batchSize) {
        this(notificationRepository, preferenceRepository, emailSender, Clock.systemUTC(), batchSize);
    }

    public NotificationEmailWorker(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository preferenceRepository,
            AfterCommitEmailSender emailSender,
            Clock clock,
            int batchSize) {
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
        this.emailSender = emailSender;
        this.clock = clock;
        this.batchSize = Math.max(1, Math.min(batchSize, 500));
    }

    @Scheduled(fixedDelayString = "${app.notification.email.poll-ms:60000}")
    @Transactional
    public int enqueueDueNotifications() {
        if (!emailSender.isTransactionalOutbox()) {
            return 0;
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Notification> pending = notificationRepository.findEmailPendingForUpdate(
            now, PageRequest.of(0, batchSize));
        int decided = 0;
        for (Notification notification : pending) {
            if (process(notification, now)) {
                decided++;
            }
        }
        return decided;
    }

    private boolean process(Notification notification, OffsetDateTime now) {
        User user = notification.getUser();
        if (user == null || user.getId() == null || user.getEmail() == null || user.getEmail().isBlank()) {
            suppress(notification, now);
            return true;
        }
        NotificationCategory category = NotificationService.categoryFor(notification.getEventType());
        if (category == null) {
            suppress(notification, now);
            return true;
        }

        NotificationPreference preference = preference(user, category);
        if (preference != null && !preference.isEnabled()) {
            suppress(notification, now);
            return true;
        }

        OffsetDateTime nextAllowed = nextAllowedAfterQuietHours(preference, now);
        if (nextAllowed != null) {
            notification.setEmailAvailableAt(nextAllowed);
            notificationRepository.save(notification);
            return false;
        }

        try {
            EventType eventType = notification.getEventType();
            emailSender.sendSystemNotification(
                user.getEmail(),
                emailMessage(notification),
                "notification-" + notification.getId(),
                user.getId(),
                notification.getReferenceId(),
                eventType == null ? "NOTIFICATION" : eventType.name(),
                EMAIL_TTL_SECONDS
            );
            notification.setEmailQueuedAt(now);
            notificationRepository.save(notification);
            return true;
        } catch (EmailDeliverySuppressedException exception) {
            suppress(notification, now);
            return true;
        } catch (RuntimeException exception) {
            log.warn("Notification email queueing failed for event {} ({})",
                notification.getEventType(), exception.getClass().getSimpleName());
            return false;
        }
    }

    private NotificationPreference preference(User user, NotificationCategory category) {
        try {
            preferenceRepository.ensureDefaults(user.getId());
            return preferenceRepository.findById(
                new NotificationPreferenceId(user.getId(), category, NotificationChannel.EMAIL)
            ).orElse(null);
        } catch (RuntimeException exception) {
            log.warn("Notification email preference lookup failed for category {} ({})",
                category, exception.getClass().getSimpleName());
            return null;
        }
    }

    private void suppress(Notification notification, OffsetDateTime now) {
        notification.setEmailSuppressedAt(now);
        notificationRepository.save(notification);
    }

    private String emailMessage(Notification notification) {
        String title = notification.getTitle() == null ? "" : notification.getTitle().strip();
        String message = notification.getMessage() == null ? "" : notification.getMessage().strip();
        if (title.isBlank()) {
            return message;
        }
        if (message.isBlank()) {
            return title;
        }
        return title + "\n\n" + message;
    }

    private OffsetDateTime nextAllowedAfterQuietHours(NotificationPreference preference, OffsetDateTime now) {
        if (preference == null || preference.getQuietHoursStart() == null
                || preference.getQuietHoursEnd() == null) {
            return null;
        }
        ZoneId zone = zone(preference.getTimezone());
        ZonedDateTime localNow = now.atZoneSameInstant(zone);
        LocalTime start = preference.getQuietHoursStart();
        LocalTime end = preference.getQuietHoursEnd();
        LocalTime current = localNow.toLocalTime();
        LocalDate endDate;
        boolean quiet;
        if (start.equals(end)) {
            quiet = true;
            endDate = localNow.toLocalDate().plusDays(1);
        } else if (start.isBefore(end)) {
            quiet = !current.isBefore(start) && current.isBefore(end);
            endDate = localNow.toLocalDate();
        } else {
            quiet = !current.isBefore(start) || current.isBefore(end);
            endDate = current.isBefore(end) ? localNow.toLocalDate() : localNow.toLocalDate().plusDays(1);
        }
        if (!quiet) {
            return null;
        }
        OffsetDateTime next = ZonedDateTime.of(endDate, end, zone).toOffsetDateTime();
        return next.isAfter(now) ? next : next.plusDays(1);
    }

    private ZoneId zone(String timezone) {
        try {
            return timezone == null || timezone.isBlank() ? DEFAULT_ZONE : ZoneId.of(timezone);
        } catch (DateTimeException exception) {
            return DEFAULT_ZONE;
        }
    }
}
