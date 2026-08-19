package com.healthcare.career.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "job_applications")
public class JobApplication {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "application_code", nullable = false, unique = true, length = 24)
    private String applicationCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_position_id", nullable = false)
    private JobPosition jobPosition;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(name = "email", nullable = false, length = 254)
    private String email;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @Column(name = "cover_letter", nullable = false, length = 4000)
    private String coverLetter;

    @Column(name = "resume_url", length = 1000)
    private String resumeUrl;

    @Column(name = "privacy_consent_at", nullable = false)
    private OffsetDateTime privacyConsentAt = OffsetDateTime.now(ZoneOffset.UTC);

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ApplicationStatus status = ApplicationStatus.SUBMITTED;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now(ZoneOffset.UTC);

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC);

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getApplicationCode() { return applicationCode; }
    public void setApplicationCode(String applicationCode) { this.applicationCode = applicationCode; }
    public JobPosition getJobPosition() { return jobPosition; }
    public void setJobPosition(JobPosition jobPosition) { this.jobPosition = jobPosition; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Integer getYearsExperience() { return yearsExperience; }
    public void setYearsExperience(Integer yearsExperience) { this.yearsExperience = yearsExperience; }
    public String getCoverLetter() { return coverLetter; }
    public void setCoverLetter(String coverLetter) { this.coverLetter = coverLetter; }
    public String getResumeUrl() { return resumeUrl; }
    public void setResumeUrl(String resumeUrl) { this.resumeUrl = resumeUrl; }
    public OffsetDateTime getPrivacyConsentAt() { return privacyConsentAt; }
    public void setPrivacyConsentAt(OffsetDateTime privacyConsentAt) { this.privacyConsentAt = privacyConsentAt; }
    public ApplicationStatus getStatus() { return status; }
    public void setStatus(ApplicationStatus status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
