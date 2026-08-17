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
@Table(name = "diagnostic_results")
public class DiagnosticResult {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private com.healthcare.appointment.entity.PatientProfile patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    private com.healthcare.hospital.entity.Doctor doctor;

    @Column(name = "test_name", nullable = false, length = 200)
    private String testName;

    @Column(name = "result", length = 4000)
    private String result;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Column(name = "test_date", nullable = false)
    private OffsetDateTime testDate = OffsetDateTime.now();

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

    public String getTestName() {
        return testName;
    }

    public void setTestName(String testName) {
        this.testName = testName;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public OffsetDateTime getTestDate() {
        return testDate;
    }

    public void setTestDate(OffsetDateTime testDate) {
        this.testDate = testDate;
    }
}
