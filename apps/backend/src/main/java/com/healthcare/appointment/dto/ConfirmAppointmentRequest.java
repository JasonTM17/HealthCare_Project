package com.healthcare.appointment.dto;

public record ConfirmAppointmentRequest(
    String bookingCode,
    String otpCode,
    String notes
) {
}
