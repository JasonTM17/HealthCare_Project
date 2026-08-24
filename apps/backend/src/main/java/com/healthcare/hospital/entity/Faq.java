package com.healthcare.hospital.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "faqs")
public class Faq {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "question", nullable = false, length = 500)
    private String question;

    @Column(name = "answer", nullable = false, length = 4000)
    private String answer;

    @Column(name = "category", length = 120)
    private String category;

    @Column(name = "topic_slug", length = 180)
    private String topicSlug;

    @Column(name = "origin_question_id")
    private UUID originQuestionId;

    @Column(name = "related_specialty_slug", length = 180)
    private String relatedSpecialtySlug;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "topic_tags", nullable = false, columnDefinition = "jsonb")
    private JsonNode topicTags = JsonNodeFactory.instance.arrayNode();

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @Column(name = "published_by")
    @JsonIgnore
    private UUID publishedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 1L;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getTopicSlug() { return topicSlug; }
    public void setTopicSlug(String topicSlug) { this.topicSlug = topicSlug; }
    public UUID getOriginQuestionId() { return originQuestionId; }
    public void setOriginQuestionId(UUID originQuestionId) { this.originQuestionId = originQuestionId; }
    public String getRelatedSpecialtySlug() { return relatedSpecialtySlug; }
    public void setRelatedSpecialtySlug(String relatedSpecialtySlug) { this.relatedSpecialtySlug = relatedSpecialtySlug; }
    public JsonNode getTopicTags() { return topicTags; }
    public void setTopicTags(JsonNode topicTags) { this.topicTags = topicTags; }
    public OffsetDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(OffsetDateTime publishedAt) { this.publishedAt = publishedAt; }
    public UUID getPublishedBy() { return publishedBy; }
    public void setPublishedBy(UUID publishedBy) { this.publishedBy = publishedBy; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
