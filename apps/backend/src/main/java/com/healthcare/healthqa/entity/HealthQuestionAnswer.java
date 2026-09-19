package com.healthcare.healthqa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "health_question_answers")
public class HealthQuestionAnswer {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private HealthQuestion question;

    @Column(name = "revision", nullable = false)
    private Integer revision = 1;

    @Column(name = "doctor_user_id", nullable = false)
    private UUID doctorUserId;

    @Column(name = "answer_text", nullable = false, length = 4000)
    private String answerText;

    @Column(name = "answer_hash", nullable = false, length = 64)
    private String answerHash;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "SUBMITTED";

    @Column(name = "reviewer_user_id")
    private UUID reviewerUserId;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "review_reason_code", length = 64)
    private String reviewReasonCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "retention_expires_at", nullable = false)
    private OffsetDateTime retentionExpiresAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "synthetic_fixture", nullable = false)
    private boolean syntheticFixture = false;

    public HealthQuestionAnswer() {
    }

    public HealthQuestionAnswer(HealthQuestion question, Integer revision, UUID doctorUserId, String answerText, String answerHash) {
        this.question = question;
        this.revision = revision;
        this.doctorUserId = doctorUserId;
        this.answerText = answerText;
        this.answerHash = answerHash;
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (retentionExpiresAt == null) {
            retentionExpiresAt = now.plusDays(90);
        }
        if (status == null) {
            status = "SUBMITTED";
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public HealthQuestion getQuestion() {
        return question;
    }

    public void setQuestion(HealthQuestion question) {
        this.question = question;
    }

    public Integer getRevision() {
        return revision;
    }

    public void setRevision(Integer revision) {
        this.revision = revision;
    }

    public UUID getDoctorUserId() {
        return doctorUserId;
    }

    public void setDoctorUserId(UUID doctorUserId) {
        this.doctorUserId = doctorUserId;
    }

    public String getAnswerText() {
        return answerText;
    }

    public void setAnswerText(String answerText) {
        this.answerText = answerText;
    }

    public String getAnswerHash() {
        return answerHash;
    }

    public void setAnswerHash(String answerHash) {
        this.answerHash = answerHash;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getReviewerUserId() {
        return reviewerUserId;
    }

    public void setReviewerUserId(UUID reviewerUserId) {
        this.reviewerUserId = reviewerUserId;
    }

    public OffsetDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(OffsetDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewReasonCode() {
        return reviewReasonCode;
    }

    public void setReviewReasonCode(String reviewReasonCode) {
        this.reviewReasonCode = reviewReasonCode;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        HealthQuestionAnswer that = (HealthQuestionAnswer) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
