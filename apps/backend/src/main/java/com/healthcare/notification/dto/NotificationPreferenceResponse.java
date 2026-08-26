package com.healthcare.notification.dto;

import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;

import java.time.LocalTime;

public record NotificationPreferenceResponse(
    NotificationCategory category,
    NotificationChannel channel,
    boolean enabled,
    LocalTime quietHoursStart,
    LocalTime quietHoursEnd,
    String timezone
) { }
