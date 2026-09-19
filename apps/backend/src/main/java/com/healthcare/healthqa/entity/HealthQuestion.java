package com.healthcare.healthqa.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "health_questions")
public class HealthQuestion {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "patient_profile_id", nullable = false)
    private UUID patientProfileId;

    @Column(name = "author_user_id", nullable = false)
    private UUID authorUserId;

    @Column(name = "thread_id")
    private UUID threadId;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "topic_slug", nullable = false, length = 64)
    private String topicSlug;

    @Column(name = "normalized_question", nullable = false, length = 1000)
    private String normalizedQuestion;

    @Column(name = "public_alias", nullable = false, length = 100)
    private String publicAlias;

    @Column(name = "pii_scan_status", nullable = false, length = 32)
    private String piiScanStatus = "PENDING";

    @Column(name = "pii_scanned_at")
    private OffsetDateTime piiScannedAt;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "PENDING_MODERATION";

    @Column(name = "moderator_user_id")
    private UUID moderatorUserId;

    @Column(name = "moderated_at")
    private OffsetDateTime moderatedAt;

    @Column(name = "moderation_reason_code", length = 64)
    private String moderationReasonCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "retention_expires_at", nullable = false)
    private OffsetDateTime retentionExpiresAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "synthetic_fixture", nullable = false)
    private boolean syntheticFixture = false;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("revision DESC")
    private List<HealthQuestionAnswer> answers = new ArrayList<>();

    public HealthQuestion() {
    }

    public HealthQuestion(UUID id, UUID patientProfileId, UUID authorUserId, String topicSlug, String normalizedQuestion, String publicAlias) {
        this.id = id;
        this.patientProfileId = patientProfileId;
        this.authorUserId = authorUserId;
        this.topicSlug = topicSlug;
        this.normalizedQuestion = normalizedQuestion;
        this.publicAlias = publicAlias;
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (retentionExpiresAt == null) {
            retentionExpiresAt = now.plusDays(90);
        }
        if (status == null) {
            status = "PENDING_MODERATION";
        }
        if (piiScanStatus == null) {
            piiScanStatus = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPatientProfileId() {
        return patientProfileId;
    }

    public void setPatientProfileId(UUID patientProfileId) {
        this.patientProfileId = patientProfileId;
    }

    public UUID getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(UUID authorUserId) {
        this.authorUserId = authorUserId;
    }

    public UUID getThreadId() {
        return threadId;
    }

    public void setThreadId(UUID threadId) {
        this.threadId = threadId;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(UUID appointmentId) {
        this.appointmentId = appointmentId;
    }

    public String getTopicSlug() {
        return topicSlug;
    }

    public void setTopicSlug(String topicSlug) {
        this.topicSlug = topicSlug;
    }

    public String getNormalizedQuestion() {
        return normalizedQuestion;
    }

    public void setNormalizedQuestion(String normalizedQuestion) {
        this.normalizedQuestion = normalizedQuestion;
    }

    public String getPublicAlias() {
        return publicAlias;
    }

    public void setPublicAlias(String publicAlias) {
        this.publicAlias = publicAlias;
    }

    public String getPiiScanStatus() {
        return piiScanStatus;
    }

    public void setPiiScanStatus(String piiScanStatus) {
        this.piiScanStatus = piiScanStatus;
    }

    public OffsetDateTime getPiiScannedAt() {
        return piiScannedAt;
    }

    public void setPiiScannedAt(OffsetDateTime piiScannedAt) {
        this.piiScannedAt = piiScannedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getModeratorUserId() {
        return moderatorUserId;
    }

    public void setModeratorUserId(UUID moderatorUserId) {
        this.moderatorUserId = moderatorUserId;
    }

    public OffsetDateTime getModeratedAt() {
        return moderatedAt;
    }

    public void setModeratedAt(OffsetDateTime moderatedAt) {
        this.moderatedAt = moderatedAt;
    }

    public String getModerationReasonCode() {
        return moderationReasonCode;
    }

    public void setModerationReasonCode(String moderationReasonCode) {
        this.moderationReasonCode = moderationReasonCode;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public OffsetDateTime getRetentionExpiresAt() {
        return retentionExpiresAt;
    }

    public void setRetentionExpiresAt(OffsetDateTime retentionExpiresAt) {
        this.retentionExpiresAt = retentionExpiresAt;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(OffsetDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public boolean isSyntheticFixture() {
        return syntheticFixture;
    }

    public void setSyntheticFixture(boolean syntheticFixture) {
        this.syntheticFixture = syntheticFixture;
    }

    public List<HealthQuestionAnswer> getAnswers() {
        return answers;
    }

    public void setAnswers(List<HealthQuestionAnswer> answers) {
        this.answers = answers;
    }

    public void addAnswer(HealthQuestionAnswer answer) {
        answers.add(answer);
        answer.setQuestion(this);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        HealthQuestion that = (HealthQuestion) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
