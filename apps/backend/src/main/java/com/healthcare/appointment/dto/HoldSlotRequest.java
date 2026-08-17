package com.healthcare.appointment.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record HoldSlotRequest(
    UUID doctorId,
    LocalDate appointmentDate,
    LocalTime startTime,
    String fullName,
    String phone,
    String email,
    String reasonForVisit,
    UUID specialtyId,
    UUID branchId,
    UUID packageId
) {
}
