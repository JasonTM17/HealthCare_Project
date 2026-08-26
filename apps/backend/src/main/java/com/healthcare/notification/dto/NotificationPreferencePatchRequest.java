package com.healthcare.notification.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalTime;

public record NotificationPreferencePatchRequest(
    Boolean enabled,
    LocalTime quietHoursStart,
    LocalTime quietHoursEnd,
    @Size(max = 64) String timezone,
    Boolean clearQuietHours
) {
    /** Backward-compatible constructor used by existing clients/tests. */
    public NotificationPreferencePatchRequest(Boolean enabled,
                                              LocalTime quietHoursStart,
                                              LocalTime quietHoursEnd,
                                              String timezone) {
        this(enabled, quietHoursStart, quietHoursEnd, timezone, false);
    }
}
