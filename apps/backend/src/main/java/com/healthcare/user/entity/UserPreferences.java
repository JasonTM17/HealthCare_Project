package com.healthcare.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One row per user, keyed by the user id to enforce ownership at the schema level. */
@Entity
@Table(name = "user_preferences")
public class UserPreferences {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "email_notifications", nullable = false)
    private boolean emailNotifications = true;

    @Column(name = "appointment_reminders", nullable = false)
    private boolean appointmentReminders = true;

    @Column(name = "marketing_emails", nullable = false)
    private boolean marketingEmails;

    @Column(name = "locale", nullable = false, length = 16)
    private String locale = "vi-VN";

    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Asia/Ho_Chi_Minh";

    // Patient-assistant configuration. Values are server-validated enums, not
    // free text: chatDefaultMode seeds new conversations, chatTone selects the
    // reply register, and chatPersonalized opts the account into server-built
    // patient context injection (never sent by the browser).
    @Column(name = "chat_default_mode", nullable = false, length = 32)
    private String chatDefaultMode = "HOSPITAL_SUPPORT";

    @Column(name = "chat_tone", nullable = false, length = 16)
    private String chatTone = "than_thien";

    @Column(name = "chat_personalized", nullable = false)
    private boolean chatPersonalized = false;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public boolean isEmailNotifications() { return emailNotifications; }
    public void setEmailNotifications(boolean value) { emailNotifications = value; }
    public boolean isAppointmentReminders() { return appointmentReminders; }
    public void setAppointmentReminders(boolean value) { appointmentReminders = value; }
    public boolean isMarketingEmails() { return marketingEmails; }
    public void setMarketingEmails(boolean value) { marketingEmails = value; }
    public String getLocale() { return locale; }
    public void setLocale(String value) { locale = value; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String value) { timezone = value; }
    public String getChatDefaultMode() { return chatDefaultMode; }
    public void setChatDefaultMode(String value) { chatDefaultMode = value; }
    public String getChatTone() { return chatTone; }
    public void setChatTone(String value) { chatTone = value; }
    public boolean isChatPersonalized() { return chatPersonalized; }
    public void setChatPersonalized(boolean value) { chatPersonalized = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
