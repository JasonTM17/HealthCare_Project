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
@Table(name = "medical_records")
public class MedicalRecord {

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

    @Column(name = "diagnosis", length = 1000)
    private String diagnosis;

    @Column(name = "notes", length = 4000)
    private String notes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public String getDiagnosis() {
        return diagnosis;
    }

    public void setDiagnosis(String diagnosis) {
        this.diagnosis = diagnosis;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
