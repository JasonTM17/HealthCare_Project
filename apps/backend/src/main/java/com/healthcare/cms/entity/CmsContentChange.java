package com.healthcare.cms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cms_content_changes")
public class CmsContentChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "content_id", nullable = false)
    private UUID contentId;

    @Column(name = "slot_key", nullable = false, length = 120)
    private String slotKey;

    @Column(name = "content_version", nullable = false)
    private long contentVersion;

    @Column(name = "published", nullable = false)
    private boolean published;

    @Column(name = "public_event", nullable = false)
    private boolean publicEvent;

    @Column(name = "actor_email", length = 320)
    private String actorEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", length = 40)
    private CmsComponentType componentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16)
    private CmsPublicationStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb")
    private JsonNode payload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "previous_payload", columnDefinition = "jsonb")
    private JsonNode previousPayload;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UUID getContentId() {
        return contentId;
    }

    public void setContentId(UUID contentId) {
        this.contentId = contentId;
    }

    public String getSlotKey() {
        return slotKey;
    }

    public void setSlotKey(String slotKey) {
        this.slotKey = slotKey;
    }

    public long getContentVersion() {
        return contentVersion;
    }

    public void setContentVersion(long contentVersion) {
        this.contentVersion = contentVersion;
    }

    public boolean isPublished() {
        return published;
    }

    public void setPublished(boolean published) {
        this.published = published;
    }

    public boolean isPublicEvent() {
        return publicEvent;
    }

    public void setPublicEvent(boolean publicEvent) {
        this.publicEvent = publicEvent;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public void setActorEmail(String actorEmail) {
        this.actorEmail = actorEmail;
    }

    public CmsComponentType getComponentType() {
        return componentType;
    }

    public void setComponentType(CmsComponentType componentType) {
        this.componentType = componentType;
    }

    public CmsPublicationStatus getStatus() {
        return status;
    }

    public void setStatus(CmsPublicationStatus status) {
        this.status = status;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }

    public JsonNode getPreviousPayload() {
        return previousPayload;
    }

    public void setPreviousPayload(JsonNode previousPayload) {
        this.previousPayload = previousPayload;
    }

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(OffsetDateTime changedAt) {
        this.changedAt = changedAt;
    }
}
