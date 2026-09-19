package com.healthcare.careplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "patient_care_plan_items")
public class PatientCarePlanItem {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "care_plan_id", nullable = false)
    private PatientCarePlan carePlan;

    @Column(name = "patient_profile_id", nullable = false)
    private UUID patientProfileId;

    @Column(name = "appointment_id", nullable = false)
    private UUID appointmentId;

    @Column(name = "doctor_id", nullable = false)
    private UUID doctorId;

    @Column(name = "sequence_number", nullable = false)
    private Integer sequenceNumber = 1;

    @Column(name = "goal", nullable = false, length = 500)
    private String goal;

    @Column(name = "reminder", length = 500)
    private String reminder;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "OPEN";

    @Column(name = "due_at")
    private OffsetDateTime dueAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

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

    public PatientCarePlanItem() {
    }

    public PatientCarePlanItem(PatientCarePlan carePlan, Integer sequenceNumber, String goal, String reminder, OffsetDateTime dueAt) {
        this.carePlan = carePlan;
        this.sequenceNumber = sequenceNumber;
        this.goal = goal;
        this.reminder = reminder;
        this.dueAt = dueAt;
        if (carePlan != null) {
            this.patientProfileId = carePlan.getPatientProfileId();
            this.appointmentId = carePlan.getAppointmentId();
            this.doctorId = carePlan.getDoctorId();
        }
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
            retentionExpiresAt = now.plusDays(365);
        }
        if (status == null) {
            status = "OPEN";
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

    public PatientCarePlan getCarePlan() {
        return carePlan;
    }

    public void setCarePlan(PatientCarePlan carePlan) {
        this.carePlan = carePlan;
    }

    public UUID getPatientProfileId() {
        return patientProfileId;
    }

    public void setPatientProfileId(UUID patientProfileId) {
        this.patientProfileId = patientProfileId;
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(UUID appointmentId) {
        this.appointmentId = appointmentId;
    }

    public UUID getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(UUID doctorId) {
        this.doctorId = doctorId;
    }

    public Integer getSequenceNumber() {
        return sequenceNumber;
    }

    public void setSequenceNumber(Integer sequenceNumber) {
        this.sequenceNumber = sequenceNumber;
    }

    public String getGoal() {
        return goal;
    }

    public void setGoal(String goal) {
        this.goal = goal;
    }

    public String getReminder() {
        return reminder;
    }

    public void setReminder(String reminder) {
        this.reminder = reminder;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getDueAt() {
        return dueAt;
    }

    public void setDueAt(OffsetDateTime dueAt) {
        this.dueAt = dueAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(OffsetDateTime completedAt) {
        this.completedAt = completedAt;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PatientCarePlanItem that = (PatientCarePlanItem) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
