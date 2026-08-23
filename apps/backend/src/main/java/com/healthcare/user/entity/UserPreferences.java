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
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
