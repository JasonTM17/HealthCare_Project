package com.healthcare.auth.entity;

import com.healthcare.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "browser_sessions")
public class BrowserSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "session_secret_hash", nullable = false, unique = true, length = 64)
    private String sessionSecretHash;

    @Column(name = "csrf_secret_hash", nullable = false, length = 64)
    private String csrfSecretHash;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt;

    @Column(name = "idle_expires_at", nullable = false)
    private OffsetDateTime idleExpiresAt;

    @Column(name = "absolute_expires_at", nullable = false)
    private OffsetDateTime absoluteExpiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "revoked_reason", length = 64)
    private String revokedReason;

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public String getSessionSecretHash() { return sessionSecretHash; }
    public String getCsrfSecretHash() { return csrfSecretHash; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public OffsetDateTime getIdleExpiresAt() { return idleExpiresAt; }
    public OffsetDateTime getAbsoluteExpiresAt() { return absoluteExpiresAt; }
    public OffsetDateTime getRevokedAt() { return revokedAt; }
    public String getRevokedReason() { return revokedReason; }
}
