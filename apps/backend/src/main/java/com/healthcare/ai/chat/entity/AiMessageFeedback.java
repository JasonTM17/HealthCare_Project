package com.healthcare.ai.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Binary feedback owned through the assistant message's conversation. */
@Entity
@Table(name = "ai_message_feedback")
public class AiMessageFeedback {

    @Id
    @Column(name = "assistant_message_id", nullable = false, updatable = false)
    private UUID assistantMessageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "rating", nullable = false, length = 16)
    private FeedbackRating rating;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getAssistantMessageId() { return assistantMessageId; }
    public void setAssistantMessageId(UUID assistantMessageId) { this.assistantMessageId = assistantMessageId; }
    public FeedbackRating getRating() { return rating; }
    public void setRating(FeedbackRating rating) { this.rating = rating; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
