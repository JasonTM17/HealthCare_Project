package com.healthcare.hospital.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "articles")
public class Article {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "slug", nullable = false, unique = true, length = 220)
    private String slug;

    @Column(name = "summary", length = 500)
    private String summary;

    @Column(name = "body", length = 8000)
    private String body;

    @Column(name = "category", length = 120)
    private String category;

    @Column(name = "author_name", length = 160)
    private String authorName;

    @Column(name = "reading_minutes")
    private Integer readingMinutes;

    @Column(name = "related_specialty_slug", length = 180)
    private String relatedSpecialtySlug;

    @Column(name = "content_kind", nullable = false, length = 24)
    private String contentKind = "GENERAL";

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @Column(name = "seo_title", length = 200)
    private String seoTitle;

    @Column(name = "seo_description", length = 500)
    private String seoDescription;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", nullable = false, columnDefinition = "jsonb")
    private JsonNode tags = JsonNodeFactory.instance.arrayNode();

    @Column(name = "scheduled_publish_at")
    private OffsetDateTime scheduledPublishAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 1L;

    @Column(name = "content_language", nullable = false, length = 12)
    private String contentLanguage = "vi";

    @Column(name = "audience", nullable = false, length = 32)
    private String audience = "GENERAL";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "topic_tags", nullable = false, columnDefinition = "jsonb")
    private JsonNode topicTags = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "key_takeaways", nullable = false, columnDefinition = "jsonb")
    private JsonNode keyTakeaways = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "warning_signs", nullable = false, columnDefinition = "jsonb")
    private JsonNode warningSigns = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prevention_tips", nullable = false, columnDefinition = "jsonb")
    private JsonNode preventionTips = JsonNodeFactory.instance.arrayNode();

    @Column(name = "when_to_seek_care", columnDefinition = "text")
    private String whenToSeekCare;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_references", nullable = false, columnDefinition = "jsonb")
    private JsonNode sourceReferences = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "clinical_metadata", nullable = false, columnDefinition = "jsonb")
    private JsonNode clinicalMetadata = JsonNodeFactory.instance.objectNode();

    @Column(name = "clinical_disclaimer", length = 2_000)
    private String clinicalDisclaimer;

    @Column(name = "last_reviewed_at")
    private OffsetDateTime lastReviewedAt;

    @Column(name = "last_reviewed_by")
    @JsonIgnore
    private UUID lastReviewedBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sections", nullable = false, columnDefinition = "jsonb")
    private JsonNode sections = JsonNodeFactory.instance.arrayNode();

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "featured", nullable = false)
    private boolean featured;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public Integer getReadingMinutes() {
        return readingMinutes;
    }

    public void setReadingMinutes(Integer readingMinutes) {
        this.readingMinutes = readingMinutes;
    }

    public String getRelatedSpecialtySlug() {
        return relatedSpecialtySlug;
    }

    public void setRelatedSpecialtySlug(String relatedSpecialtySlug) {
        this.relatedSpecialtySlug = relatedSpecialtySlug;
    }

    public String getContentKind() { return contentKind; }
    public void setContentKind(String contentKind) { this.contentKind = contentKind; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }
    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }
    public JsonNode getTags() { return tags; }
    public void setTags(JsonNode tags) { this.tags = tags; }
    public OffsetDateTime getScheduledPublishAt() { return scheduledPublishAt; }
    public void setScheduledPublishAt(OffsetDateTime scheduledPublishAt) { this.scheduledPublishAt = scheduledPublishAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getContentLanguage() { return contentLanguage; }
    public void setContentLanguage(String contentLanguage) { this.contentLanguage = contentLanguage; }
    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }
    public JsonNode getTopicTags() { return topicTags; }
    public void setTopicTags(JsonNode topicTags) { this.topicTags = topicTags; }
    public JsonNode getKeyTakeaways() { return keyTakeaways; }
    public void setKeyTakeaways(JsonNode keyTakeaways) { this.keyTakeaways = keyTakeaways; }
    public JsonNode getWarningSigns() { return warningSigns; }
    public void setWarningSigns(JsonNode warningSigns) { this.warningSigns = warningSigns; }
    public JsonNode getPreventionTips() { return preventionTips; }
    public void setPreventionTips(JsonNode preventionTips) { this.preventionTips = preventionTips; }
    public String getWhenToSeekCare() { return whenToSeekCare; }
    public void setWhenToSeekCare(String whenToSeekCare) { this.whenToSeekCare = whenToSeekCare; }
    public JsonNode getSourceReferences() { return sourceReferences; }
    public void setSourceReferences(JsonNode sourceReferences) { this.sourceReferences = sourceReferences; }
    public JsonNode getClinicalMetadata() { return clinicalMetadata; }
    public void setClinicalMetadata(JsonNode clinicalMetadata) { this.clinicalMetadata = clinicalMetadata; }
    public String getClinicalDisclaimer() { return clinicalDisclaimer; }
    public void setClinicalDisclaimer(String clinicalDisclaimer) { this.clinicalDisclaimer = clinicalDisclaimer; }
    public OffsetDateTime getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(OffsetDateTime lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }
    public UUID getLastReviewedBy() { return lastReviewedBy; }
    public void setLastReviewedBy(UUID lastReviewedBy) { this.lastReviewedBy = lastReviewedBy; }

    public JsonNode getSections() {
        return sections;
    }

    public void setSections(JsonNode sections) {
        this.sections = sections;
    }

    public OffsetDateTime getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(OffsetDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
}
