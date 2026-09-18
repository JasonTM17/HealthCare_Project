package com.healthcare.academic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "defense_committee_members")
public class DefenseCommitteeMember {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thesis_id", nullable = false)
    private AcademicThesis thesis;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecturer_id", nullable = false)
    private FacultyLecturer lecturer;

    @Column(name = "committee_role", nullable = false, length = 30)
    private String committeeRole = "MEMBER"; // CHAIR, SECRETARY, REVIEWER, MEMBER

    @Column(name = "score", precision = 4, scale = 2)
    private BigDecimal score;

    @Column(name = "evaluation_notes", columnDefinition = "TEXT")
    private String evaluationNotes;

    @Column(name = "evaluated_at")
    private OffsetDateTime evaluatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public AcademicThesis getThesis() {
        return thesis;
    }

    public void setThesis(AcademicThesis thesis) {
        this.thesis = thesis;
    }

    public FacultyLecturer getLecturer() {
        return lecturer;
    }

    public void setLecturer(FacultyLecturer lecturer) {
        this.lecturer = lecturer;
    }

    public String getCommitteeRole() {
        return committeeRole;
    }

    public void setCommitteeRole(String committeeRole) {
        this.committeeRole = committeeRole;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public String getEvaluationNotes() {
        return evaluationNotes;
    }

    public void setEvaluationNotes(String evaluationNotes) {
        this.evaluationNotes = evaluationNotes;
    }

    public OffsetDateTime getEvaluatedAt() {
        return evaluatedAt;
    }

    public void setEvaluatedAt(OffsetDateTime evaluatedAt) {
        this.evaluatedAt = evaluatedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
