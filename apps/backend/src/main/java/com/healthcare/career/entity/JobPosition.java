package com.healthcare.career.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "job_positions")
public class JobPosition {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "slug", nullable = false, unique = true, length = 180)
    private String slug;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Column(name = "department", nullable = false, length = 120)
    private String department;

    @Column(name = "location", nullable = false, length = 200)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", nullable = false, length = 32)
    private EmploymentType employmentType;

    @Column(name = "summary", nullable = false, length = 1200)
    private String summary;

    @Column(name = "responsibilities", nullable = false, length = 6000)
    private String responsibilities;

    @Column(name = "requirements", nullable = false, length = 6000)
    private String requirements;

    @Column(name = "benefits", nullable = false, length = 4000)
    private String benefits;

    @Column(name = "deadline")
    private LocalDate deadline;

    @Column(name = "featured", nullable = false)
    private boolean featured;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now(ZoneOffset.UTC);

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC);

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public EmploymentType getEmploymentType() { return employmentType; }
    public void setEmploymentType(EmploymentType employmentType) { this.employmentType = employmentType; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getResponsibilities() { return responsibilities; }
    public void setResponsibilities(String responsibilities) { this.responsibilities = responsibilities; }
    public String getRequirements() { return requirements; }
    public void setRequirements(String requirements) { this.requirements = requirements; }
    public String getBenefits() { return benefits; }
    public void setBenefits(String benefits) { this.benefits = benefits; }
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
