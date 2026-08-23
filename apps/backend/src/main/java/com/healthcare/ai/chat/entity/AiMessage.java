package com.healthcare.ai.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "ai_messages")
public class AiMessage {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private AiConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_message_id")
    private AiMessage requestMessage;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private AiMessageRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private AiMessageStatus status;

    @Column(name = "content", nullable = false, length = 10_000)
    private String content;

    @Column(name = "sequence_number", nullable = false)
    private long sequenceNumber;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "disclaimer", length = 1_000)
    private String disclaimer;

    @Column(name = "provenance", length = 32)
    private String provenance;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "citations", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, String>> citations = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public AiConversation getConversation() { return conversation; }
    public void setConversation(AiConversation conversation) { this.conversation = conversation; }
    public AiMessage getRequestMessage() { return requestMessage; }
    public void setRequestMessage(AiMessage requestMessage) { this.requestMessage = requestMessage; }
    public AiMessageRole getRole() { return role; }
    public void setRole(AiMessageRole role) { this.role = role; }
    public AiMessageStatus getStatus() { return status; }
    public void setStatus(AiMessageStatus status) { this.status = status; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public long getSequenceNumber() { return sequenceNumber; }
    public void setSequenceNumber(long sequenceNumber) { this.sequenceNumber = sequenceNumber; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getDisclaimer() { return disclaimer; }
    public void setDisclaimer(String disclaimer) { this.disclaimer = disclaimer; }
    public String getProvenance() { return provenance; }
    public void setProvenance(String provenance) { this.provenance = provenance; }
    public List<Map<String, String>> getCitations() { return citations; }
    public void setCitations(List<Map<String, String>> citations) { this.citations = citations; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
}
