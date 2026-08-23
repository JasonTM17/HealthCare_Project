package com.healthcare.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;

public record UserPreferencesPatchRequest(
    @JsonAlias({"emailNotificationsEnabled"})
    Boolean emailNotifications,
    @JsonAlias({"appointmentRemindersEnabled"})
    Boolean appointmentReminders,
    @JsonAlias({"marketingEmailsEnabled"})
    Boolean marketingEmails,
    @Size(max = 16, message = "Locale must not exceed 16 characters")
    String locale,
    @Size(max = 64, message = "Timezone must not exceed 64 characters")
    String timezone
) {
    public UserPreferencesPatchRequest(Boolean emailNotifications, Boolean appointmentReminders, Boolean marketingEmails) {
        this(emailNotifications, appointmentReminders, marketingEmails, null, null);
    }
}
