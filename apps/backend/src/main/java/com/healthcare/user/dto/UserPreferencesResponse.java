package com.healthcare.user.dto;

import java.time.OffsetDateTime;

public record UserPreferencesResponse(
    boolean emailNotifications,
    boolean appointmentReminders,
    boolean marketingEmails,
    String locale,
    String timezone,
    String chatDefaultMode,
    String chatTone,
    boolean chatPersonalized,
    OffsetDateTime updatedAt
) {
}
