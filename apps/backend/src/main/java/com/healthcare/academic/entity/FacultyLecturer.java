package com.healthcare.academic.entity;

import com.healthcare.hospital.entity.Doctor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "faculty_lecturers")
public class FacultyLecturer {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false, unique = true)
    private Doctor doctor;

    @Column(name = "academic_rank", nullable = false, length = 20)
    private String academicRank = "ThS"; // GS, PGS, TS, ThS, BS.CKII, BS.CKI

    @Column(name = "academic_title", length = 120)
    private String academicTitle = "Giảng viên";

    @Column(name = "department", nullable = false, length = 160)
    private String department = "Bộ môn Y học Lâm sàng";

    @Column(name = "max_theses", nullable = false)
    private Integer maxTheses = 5;

    @Column(name = "current_theses_count", nullable = false)
    private Integer currentThesesCount = 0;

    @Column(name = "biography", columnDefinition = "TEXT")
    private String biography;

    @Column(name = "active", nullable = false)
    private boolean active = true;

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

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public String getAcademicRank() {
        return academicRank;
    }

    public void setAcademicRank(String academicRank) {
        this.academicRank = academicRank;
    }

    public String getAcademicTitle() {
        return academicTitle;
    }

    public void setAcademicTitle(String academicTitle) {
        this.academicTitle = academicTitle;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public Integer getMaxTheses() {
        return maxTheses;
    }

    public void setMaxTheses(Integer maxTheses) {
        this.maxTheses = maxTheses;
    }

    public Integer getCurrentThesesCount() {
        return currentThesesCount;
    }

    public void setCurrentThesesCount(Integer currentThesesCount) {
        this.currentThesesCount = currentThesesCount;
    }

    public String getBiography() {
        return biography;
    }

    public void setBiography(String biography) {
        this.biography = biography;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
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
