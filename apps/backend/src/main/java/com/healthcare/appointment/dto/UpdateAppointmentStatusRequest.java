package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.AppointmentStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateAppointmentStatusRequest(
    @NotNull AppointmentStatus status
) {
}
