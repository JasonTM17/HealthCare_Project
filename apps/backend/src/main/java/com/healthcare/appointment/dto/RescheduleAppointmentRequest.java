package com.healthcare.appointment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record RescheduleAppointmentRequest(
    @NotNull LocalDate appointmentDate,
    @NotNull LocalTime startTime,
    UUID branchId,
    @Size(max = 20)
    @Pattern(regexp = "^[+0-9() .-]+$", message = "Số điện thoại không hợp lệ") String phone
) {
}
