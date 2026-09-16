package com.healthcare.clinical.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "diagnostic_orders")
public class DiagnosticOrder {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private com.healthcare.appointment.entity.PatientProfile patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private com.healthcare.hospital.entity.Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private com.healthcare.appointment.entity.Appointment appointment;

    @Column(name = "test_name", nullable = false, length = 200)
    private String testName;

    @Column(name = "notes", length = 1000)
    private String notes;

    /** REQUESTED | COLLECTED | COMPLETED | CANCELLED (V76 CHECK). */
    @Column(name = "status", nullable = false, length = 24)
    private String status = "REQUESTED";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public com.healthcare.appointment.entity.PatientProfile getPatient() {
        return patient;
    }

    public void setPatient(com.healthcare.appointment.entity.PatientProfile patient) {
        this.patient = patient;
    }

    public com.healthcare.hospital.entity.Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(com.healthcare.hospital.entity.Doctor doctor) {
        this.doctor = doctor;
    }

    public com.healthcare.appointment.entity.Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(com.healthcare.appointment.entity.Appointment appointment) {
        this.appointment = appointment;
    }

    public String getTestName() {
        return testName;
    }

    public void setTestName(String testName) {
        this.testName = testName;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
