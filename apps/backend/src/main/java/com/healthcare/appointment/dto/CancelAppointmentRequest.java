package com.healthcare.appointment.dto;

public record CancelAppointmentRequest(
    String reason,
    String phone
) {
}
