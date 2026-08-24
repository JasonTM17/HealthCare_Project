package com.healthcare.hospital.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "specialties")
public class Specialty {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 180)
    private String slug;

    @Column(name = "description", length = 2000)
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "common_symptoms", nullable = false, columnDefinition = "jsonb")
    private JsonNode commonSymptoms = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preparation_steps", nullable = false, columnDefinition = "jsonb")
    private JsonNode preparationSteps = JsonNodeFactory.instance.arrayNode();

    @Column(name = "care_pathway", columnDefinition = "text")
    private String carePathway;

    @Column(name = "clinical_overview", columnDefinition = "text")
    private String clinicalOverview;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "common_conditions", nullable = false, columnDefinition = "jsonb")
    private JsonNode commonConditions = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "red_flags", nullable = false, columnDefinition = "jsonb")
    private JsonNode redFlags = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preventive_care", nullable = false, columnDefinition = "jsonb")
    private JsonNode preventiveCare = JsonNodeFactory.instance.arrayNode();

    @Column(name = "when_to_seek_care", columnDefinition = "text")
    private String whenToSeekCare;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_references", nullable = false, columnDefinition = "jsonb")
    private JsonNode sourceReferences = JsonNodeFactory.instance.arrayNode();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "clinical_metadata", nullable = false, columnDefinition = "jsonb")
    private JsonNode clinicalMetadata = JsonNodeFactory.instance.objectNode();

    @Column(name = "last_reviewed_at")
    private OffsetDateTime lastReviewedAt;

    @Column(name = "last_reviewed_by")
    @JsonIgnore
    private UUID lastReviewedBy;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public JsonNode getCommonSymptoms() {
        return commonSymptoms;
    }

    public void setCommonSymptoms(JsonNode commonSymptoms) {
        this.commonSymptoms = commonSymptoms;
    }

    public JsonNode getPreparationSteps() {
        return preparationSteps;
    }

    public void setPreparationSteps(JsonNode preparationSteps) {
        this.preparationSteps = preparationSteps;
    }

    public String getCarePathway() {
        return carePathway;
    }

    public void setCarePathway(String carePathway) {
        this.carePathway = carePathway;
    }

    public String getClinicalOverview() { return clinicalOverview; }
    public void setClinicalOverview(String clinicalOverview) { this.clinicalOverview = clinicalOverview; }
    public JsonNode getCommonConditions() { return commonConditions; }
    public void setCommonConditions(JsonNode commonConditions) { this.commonConditions = commonConditions; }
    public JsonNode getRedFlags() { return redFlags; }
    public void setRedFlags(JsonNode redFlags) { this.redFlags = redFlags; }
    public JsonNode getPreventiveCare() { return preventiveCare; }
    public void setPreventiveCare(JsonNode preventiveCare) { this.preventiveCare = preventiveCare; }
    public String getWhenToSeekCare() { return whenToSeekCare; }
    public void setWhenToSeekCare(String whenToSeekCare) { this.whenToSeekCare = whenToSeekCare; }
    public JsonNode getSourceReferences() { return sourceReferences; }
    public void setSourceReferences(JsonNode sourceReferences) { this.sourceReferences = sourceReferences; }
    public JsonNode getClinicalMetadata() { return clinicalMetadata; }
    public void setClinicalMetadata(JsonNode clinicalMetadata) { this.clinicalMetadata = clinicalMetadata; }
    public OffsetDateTime getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(OffsetDateTime lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }
    public UUID getLastReviewedBy() { return lastReviewedBy; }
    public void setLastReviewedBy(UUID lastReviewedBy) { this.lastReviewedBy = lastReviewedBy; }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
