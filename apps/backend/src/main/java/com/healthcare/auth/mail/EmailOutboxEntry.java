package com.healthcare.auth.mail;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Durable transactional email envelope. The payload is encrypted before it
 * reaches this entity; no rendered message is persisted in clear text.
 */
@Entity
@Table(name = "email_outbox", indexes = {
    @Index(name = "idx_email_outbox_due", columnList = "status,available_at,created_at"),
    @Index(name = "idx_email_outbox_expiry", columnList = "expires_at")
})
public class EmailOutboxEntry {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "event_reference_id")
    private UUID eventReferenceId;

    @Column(name = "event_type", length = 64)
    private String eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_key", nullable = false, length = 64)
    private EmailTemplateKey templateKey;

    @Column(name = "template_version", nullable = false)
    private int templateVersion = 1;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 128)
    private String idempotencyKey;

    @Column(name = "payload_ciphertext", columnDefinition = "bytea")
    private byte[] payloadCiphertext;

    @Column(name = "payload_nonce", columnDefinition = "bytea")
    private byte[] payloadNonce;

    @Column(name = "payload_digest", length = 64)
    private String payloadDigest;

    @Column(name = "delivery_message_id", length = 160)
    private String deliveryMessageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private EmailOutboxStatus status = EmailOutboxStatus.QUEUED;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "available_at", nullable = false)
    private OffsetDateTime availableAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "lease_token")
    private UUID leaseToken;

    @Column(name = "lease_expires_at")
    private OffsetDateTime leaseExpiresAt;

    @Column(name = "last_error_code", length = 64)
    private String lastErrorCode;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID value) { userId = value; }
    public UUID getEventReferenceId() { return eventReferenceId; }
    public void setEventReferenceId(UUID value) { eventReferenceId = value; }
    public String getEventType() { return eventType; }
    public void setEventType(String value) { eventType = value; }
    public EmailTemplateKey getTemplateKey() { return templateKey; }
    public void setTemplateKey(EmailTemplateKey value) { templateKey = value; }
    public int getTemplateVersion() { return templateVersion; }
    public void setTemplateVersion(int value) { templateVersion = value; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String value) { idempotencyKey = value; }
    public byte[] getPayloadCiphertext() { return payloadCiphertext; }
    public void setPayloadCiphertext(byte[] value) { payloadCiphertext = value; }
    public byte[] getPayloadNonce() { return payloadNonce; }
    public void setPayloadNonce(byte[] value) { payloadNonce = value; }
    public String getPayloadDigest() { return payloadDigest; }
    public void setPayloadDigest(String value) { payloadDigest = value; }
    public String getDeliveryMessageId() { return deliveryMessageId; }
    public void setDeliveryMessageId(String value) { deliveryMessageId = value; }
    public EmailOutboxStatus getStatus() { return status; }
    public void setStatus(EmailOutboxStatus value) { status = value; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int value) { attempts = value; }
    public OffsetDateTime getAvailableAt() { return availableAt; }
    public void setAvailableAt(OffsetDateTime value) { availableAt = value; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime value) { expiresAt = value; }
    public UUID getLeaseToken() { return leaseToken; }
    public void setLeaseToken(UUID value) { leaseToken = value; }
    public OffsetDateTime getLeaseExpiresAt() { return leaseExpiresAt; }
    public void setLeaseExpiresAt(OffsetDateTime value) { leaseExpiresAt = value; }
    public String getLastErrorCode() { return lastErrorCode; }
    public void setLastErrorCode(String value) { lastErrorCode = value; }
    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime value) { sentAt = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime value) { createdAt = value; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime value) { updatedAt = value; }
}
