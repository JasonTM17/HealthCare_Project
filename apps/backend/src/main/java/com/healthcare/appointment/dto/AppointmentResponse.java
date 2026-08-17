package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.AppointmentStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentResponse(
    UUID id,
    String bookingCode,
    String patientName,
    String patientPhone,
    String patientEmail,
    UUID doctorId,
    String doctorName,
    String doctorTitle,
    String specialtyName,
    String branchName,
    String branchAddress,
    String packageName,
    LocalDate appointmentDate,
    LocalTime startTime,
    LocalTime endTime,
    AppointmentStatus status,
    String paymentStatus,
    String reasonForVisit,
    OffsetDateTime createdAt
) {
}
