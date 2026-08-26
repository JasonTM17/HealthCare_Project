package com.healthcare.notification.entity;

import jakarta.persistence.Embeddable;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
public class NotificationPreferenceId implements Serializable {
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 32)
    private NotificationCategory category;
    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 16)
    private NotificationChannel channel;

    public NotificationPreferenceId() { }
    public NotificationPreferenceId(UUID userId, NotificationCategory category, NotificationChannel channel) {
        this.userId = userId;
        this.category = category;
        this.channel = channel;
    }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID value) { userId = value; }
    public NotificationCategory getCategory() { return category; }
    public void setCategory(NotificationCategory value) { category = value; }
    public NotificationChannel getChannel() { return channel; }
    public void setChannel(NotificationChannel value) { channel = value; }
    @Override public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof NotificationPreferenceId that)) return false;
        return java.util.Objects.equals(userId, that.userId)
            && category == that.category && channel == that.channel;
    }
    @Override public int hashCode() { return java.util.Objects.hash(userId, category, channel); }
}
