package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.AppointmentStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Least-privilege appointment view for the authenticated patient portal.
 * Patient contact data and appointment OTP fields are intentionally absent.
 */
public record PatientAppointmentResponse(
    UUID id,
    String bookingCode,
    UUID doctorId,
    String doctorName,
    String specialtyName,
    UUID branchId,
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
