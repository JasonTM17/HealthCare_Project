package com.healthcare.appointment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class Appointment {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "booking_code", unique = true, length = 32)
    private String bookingCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private com.healthcare.appointment.entity.PatientProfile patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private com.healthcare.hospital.entity.Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private com.healthcare.hospital.entity.Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialty_id")
    private com.healthcare.hospital.entity.Specialty specialty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_id")
    private com.healthcare.hospital.entity.Package medicalPackage;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "appointment_time", nullable = false)
    private OffsetDateTime appointmentTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private AppointmentStatus status = AppointmentStatus.PENDING_CONFIRMATION;

    @Column(name = "payment_status", length = 32)
    private String paymentStatus = "UNPAID";

    @Column(name = "reason_for_visit", length = 1000)
    private String reasonForVisit;

    @Column(name = "notes", length = 2000)
    private String notes;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "hold_expires_at")
    private OffsetDateTime holdExpiresAt;

    @Column(name = "otp_code", length = 10)
    private String otpCode;

    @Column(name = "otp_expires_at")
    private OffsetDateTime otpExpiresAt;

    @Column(name = "otp_attempts", nullable = false)
    private int otpAttempts;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getBookingCode() {
        return bookingCode;
    }

    public void setBookingCode(String bookingCode) {
        this.bookingCode = bookingCode;
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

    public com.healthcare.hospital.entity.Branch getBranch() {
        return branch;
    }

    public void setBranch(com.healthcare.hospital.entity.Branch branch) {
        this.branch = branch;
    }

    public com.healthcare.hospital.entity.Specialty getSpecialty() {
        return specialty;
    }

    public void setSpecialty(com.healthcare.hospital.entity.Specialty specialty) {
        this.specialty = specialty;
    }

    public com.healthcare.hospital.entity.Package getMedicalPackage() {
        return medicalPackage;
    }

    public void setMedicalPackage(com.healthcare.hospital.entity.Package medicalPackage) {
        this.medicalPackage = medicalPackage;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(LocalDate appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public OffsetDateTime getAppointmentTime() {
        return appointmentTime;
    }

    public void setAppointmentTime(OffsetDateTime appointmentTime) {
        this.appointmentTime = appointmentTime;
    }

    public AppointmentStatus getStatus() {
        return status;
    }

    public void setStatus(AppointmentStatus status) {
        this.status = status;
    }

    public void setStatus(String status) {
        this.status = AppointmentStatus.valueOf(status);
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getReasonForVisit() {
        return reasonForVisit;
    }

    public void setReasonForVisit(String reasonForVisit) {
        this.reasonForVisit = reasonForVisit;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void setCancellationReason(String cancellationReason) {
        this.cancellationReason = cancellationReason;
    }

    public OffsetDateTime getHoldExpiresAt() {
        return holdExpiresAt;
    }

    public void setHoldExpiresAt(OffsetDateTime holdExpiresAt) {
        this.holdExpiresAt = holdExpiresAt;
    }

    public String getOtpCode() {
        return otpCode;
    }

    public void setOtpCode(String otpCode) {
        this.otpCode = otpCode;
    }

    public OffsetDateTime getOtpExpiresAt() {
        return otpExpiresAt;
    }

    public void setOtpExpiresAt(OffsetDateTime otpExpiresAt) {
        this.otpExpiresAt = otpExpiresAt;
    }

    public int getOtpAttempts() {
        return otpAttempts;
    }

    public void setOtpAttempts(int otpAttempts) {
        this.otpAttempts = otpAttempts;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
