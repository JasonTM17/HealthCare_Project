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

import java.util.UUID;

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

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
