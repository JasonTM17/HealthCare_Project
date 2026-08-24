package com.healthcare.ai.chat.entity;

import com.healthcare.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_conversations")
public class AiConversation {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "title", nullable = false, length = 160)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private AiConversationStatus status = AiConversationStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 32)
    private ChatMode mode = ChatMode.HOSPITAL_SUPPORT;

    @Column(name = "consent_version", length = 64)
    private String consentVersion;

    @Column(name = "consented_at")
    private OffsetDateTime consentedAt;

    @Column(name = "in_flight", nullable = false)
    private boolean inFlight;

    @Column(name = "in_flight_started_at")
    private OffsetDateTime inFlightStartedAt;

    @Column(name = "in_flight_token")
    private UUID inFlightToken;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "last_message_at")
    private OffsetDateTime lastMessageAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public AiConversationStatus getStatus() { return status; }
    public void setStatus(AiConversationStatus status) { this.status = status; }
    public ChatMode getMode() { return mode; }
    public void setMode(ChatMode mode) { this.mode = mode == null ? ChatMode.HOSPITAL_SUPPORT : mode; }
    public String getConsentVersion() { return consentVersion; }
    public void setConsentVersion(String consentVersion) { this.consentVersion = consentVersion; }
    public OffsetDateTime getConsentedAt() { return consentedAt; }
    public void setConsentedAt(OffsetDateTime consentedAt) { this.consentedAt = consentedAt; }
    public boolean isInFlight() { return inFlight; }
    public void setInFlight(boolean inFlight) { this.inFlight = inFlight; }
    public OffsetDateTime getInFlightStartedAt() { return inFlightStartedAt; }
    public void setInFlightStartedAt(OffsetDateTime inFlightStartedAt) { this.inFlightStartedAt = inFlightStartedAt; }
    public UUID getInFlightToken() { return inFlightToken; }
    public void setInFlightToken(UUID inFlightToken) { this.inFlightToken = inFlightToken; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public OffsetDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(OffsetDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
}
