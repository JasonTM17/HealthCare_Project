package com.healthcare.academic.entity;

import com.healthcare.hospital.entity.Specialty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "academic_theses")
public class AcademicThesis {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "topic_code", nullable = false, unique = true, length = 60)
    private String topicCode;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "abstract_text", columnDefinition = "TEXT")
    private String abstractText;

    @Column(name = "academic_year", nullable = false, length = 20)
    private String academicYear = "2025-2026";

    @Column(name = "training_level", nullable = false, length = 40)
    private String trainingLevel = "GRADUATION_THESIS"; // GRADUATION_THESIS, RESIDENCY_DISSERTATION, MASTER_THESIS

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialty_id")
    private Specialty specialty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "primary_supervisor_id", nullable = false)
    private FacultyLecturer primarySupervisor;

    @Column(name = "student_name", nullable = false, length = 160)
    private String studentName;

    @Column(name = "student_code", nullable = false, length = 50)
    private String studentCode;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PROPOSED"; // PROPOSED, APPROVED, IN_PROGRESS, DEFENSE_SCHEDULED, DEFENDED, REJECTED

    @Column(name = "defense_score", precision = 4, scale = 2)
    private BigDecimal defenseScore;

    @Column(name = "defense_date")
    private OffsetDateTime defenseDate;

    @Column(name = "defense_location", length = 200)
    private String defenseLocation;

    @Column(name = "thesis_document_url", length = 500)
    private String thesisDocumentUrl;

    @Column(name = "submission_notes", columnDefinition = "TEXT")
    private String submissionNotes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTopicCode() {
        return topicCode;
    }

    public void setTopicCode(String topicCode) {
        this.topicCode = topicCode;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAbstractText() {
        return abstractText;
    }

    public void setAbstractText(String abstractText) {
        this.abstractText = abstractText;
    }

    public String getAcademicYear() {
        return academicYear;
    }

    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }

    public String getTrainingLevel() {
        return trainingLevel;
    }

    public void setTrainingLevel(String trainingLevel) {
        this.trainingLevel = trainingLevel;
    }

    public Specialty getSpecialty() {
        return specialty;
    }

    public void setSpecialty(Specialty specialty) {
        this.specialty = specialty;
    }

    public FacultyLecturer getPrimarySupervisor() {
        return primarySupervisor;
    }

    public void setPrimarySupervisor(FacultyLecturer primarySupervisor) {
        this.primarySupervisor = primarySupervisor;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getStudentCode() {
        return studentCode;
    }

    public void setStudentCode(String studentCode) {
        this.studentCode = studentCode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getDefenseScore() {
        return defenseScore;
    }

    public void setDefenseScore(BigDecimal defenseScore) {
        this.defenseScore = defenseScore;
    }

    public OffsetDateTime getDefenseDate() {
        return defenseDate;
    }

    public void setDefenseDate(OffsetDateTime defenseDate) {
        this.defenseDate = defenseDate;
    }

    public String getDefenseLocation() {
        return defenseLocation;
    }

    public void setDefenseLocation(String defenseLocation) {
        this.defenseLocation = defenseLocation;
    }

    public String getThesisDocumentUrl() {
        return thesisDocumentUrl;
    }

    public void setThesisDocumentUrl(String thesisDocumentUrl) {
        this.thesisDocumentUrl = thesisDocumentUrl;
    }

    public String getSubmissionNotes() {
        return submissionNotes;
    }

    public void setSubmissionNotes(String submissionNotes) {
        this.submissionNotes = submissionNotes;
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
}
