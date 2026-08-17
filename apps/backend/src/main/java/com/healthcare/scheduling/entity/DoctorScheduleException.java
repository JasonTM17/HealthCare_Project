package com.healthcare.scheduling.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "doctor_schedule_exceptions")
public class DoctorScheduleException {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private com.healthcare.hospital.entity.Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private com.healthcare.hospital.entity.Branch branch;

    @Column(name = "exception_date", nullable = false)
    private LocalDate exceptionDate;

    @Column(name = "type", nullable = false, length = 32)
    private String type;

    @Column(name = "custom_start_time")
    private LocalTime customStartTime;

    @Column(name = "custom_end_time")
    private LocalTime customEndTime;

    @Column(name = "reason", length = 255)
    private String reason;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public com.healthcare.hospital.entity.Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(com.healthcare.hospital.entity.Doctor doctor) {
        this.doctor = doctor;
    }

    public com.healthcare.hospital.entity.Branch getBranch() {
        return branch;
    }

    public void setBranch(com.healthcare.hospital.entity.Branch branch) {
        this.branch = branch;
    }

    public LocalDate getExceptionDate() {
        return exceptionDate;
    }

    public void setExceptionDate(LocalDate exceptionDate) {
        this.exceptionDate = exceptionDate;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public LocalTime getCustomStartTime() {
        return customStartTime;
    }

    public void setCustomStartTime(LocalTime customStartTime) {
        this.customStartTime = customStartTime;
    }

    public LocalTime getCustomEndTime() {
        return customEndTime;
    }

    public void setCustomEndTime(LocalTime customEndTime) {
        this.customEndTime = customEndTime;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
