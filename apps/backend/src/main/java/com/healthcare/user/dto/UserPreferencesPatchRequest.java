package com.healthcare.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Pattern;
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
    String timezone,
    @Size(max = 32, message = "Chat default mode must not exceed 32 characters")
    @Pattern(regexp = "^(HOSPITAL_SUPPORT|SYMPTOM_TRIAGE|HEALTH_EDUCATION)$",
        message = "Chat default mode is not a supported assistant mode")
    String chatDefaultMode,
    @Size(max = 16, message = "Chat tone must not exceed 16 characters")
    @Pattern(regexp = "^(than_thien|chuyen_nghiep|ngan_gon)$",
        message = "Chat tone is not a supported assistant tone")
    String chatTone,
    Boolean chatPersonalized
) {
    public UserPreferencesPatchRequest(
            Boolean emailNotifications, Boolean appointmentReminders, Boolean marketingEmails) {
        this(emailNotifications, appointmentReminders, marketingEmails, null, null, null, null, null);
    }
}
