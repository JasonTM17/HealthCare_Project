package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.AppointmentStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Least-privilege appointment view for the authenticated doctor portal.
 * Patient contact data, payment details, and appointment OTP fields are
 * intentionally absent.
 */
public record DoctorAppointmentResponse(
    UUID id,
    String bookingCode,
    UUID patientId,
    String patientName,
    String specialtyName,
    UUID branchId,
    String branchName,
    String branchAddress,
    String packageName,
    LocalDate appointmentDate,
    LocalTime startTime,
    LocalTime endTime,
    AppointmentStatus status,
    String reasonForVisit,
    OffsetDateTime createdAt
) {
}
