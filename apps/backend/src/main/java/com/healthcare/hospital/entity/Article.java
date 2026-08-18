package com.healthcare.hospital.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sections", nullable = false, columnDefinition = "jsonb")
    private JsonNode sections = JsonNodeFactory.instance.arrayNode();

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @Column(name = "active", nullable = false)
    private boolean active = true;

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
}
