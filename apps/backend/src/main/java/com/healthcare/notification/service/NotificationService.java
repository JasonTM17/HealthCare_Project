package com.healthcare.notification.service;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.notification.dto.NotificationResponse;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Notification create(UUID userId, EventType eventType, String title, String message, UUID referenceId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setEventType(eventType);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        return notificationRepository.save(notification);
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> listForUser(UserDetails principal, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(resolveUser(principal).getId(), pageable)
            .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UserDetails principal) {
        return notificationRepository.countByUserIdAndReadFalse(resolveUser(principal).getId());
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
