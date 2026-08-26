package com.healthcare.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.LocalTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "notification_preferences")
public class NotificationPreference {
    @EmbeddedId
    private NotificationPreferenceId id;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", insertable = false, updatable = false, length = 32)
    private NotificationCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", insertable = false, updatable = false, length = 16)
    private NotificationChannel channel;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;
    @Column(name = "quiet_hours_start")
    private LocalTime quietHoursStart;
    @Column(name = "quiet_hours_end")
    private LocalTime quietHoursEnd;
    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Asia/Ho_Chi_Minh";
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public NotificationPreferenceId getId() { return id; }
    public void setId(NotificationPreferenceId value) { id = value; }
    public NotificationCategory getCategory() { return category != null ? category : id.getCategory(); }
    public NotificationChannel getChannel() { return channel != null ? channel : id.getChannel(); }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public LocalTime getQuietHoursStart() { return quietHoursStart; }
    public void setQuietHoursStart(LocalTime value) { quietHoursStart = value; }
    public LocalTime getQuietHoursEnd() { return quietHoursEnd; }
    public void setQuietHoursEnd(LocalTime value) { quietHoursEnd = value; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String value) { timezone = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime value) { createdAt = value; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime value) { updatedAt = value; }
}
