package com.healthcare.notification.dto;

import com.healthcare.notification.entity.Notification;

import java.time.OffsetDateTime;
import java.util.UUID;

public record NotificationResponse(
    UUID id,
    String eventType,
    String title,
    String message,
    UUID referenceId,
    boolean read,
    OffsetDateTime createdAt,
    OffsetDateTime readAt
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getEventType().name(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getReferenceId(),
            notification.isRead(),
            notification.getCreatedAt(),
            notification.getReadAt()
        );
    }
}
