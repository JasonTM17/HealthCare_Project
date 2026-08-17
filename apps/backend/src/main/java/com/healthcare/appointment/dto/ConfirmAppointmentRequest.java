package com.healthcare.appointment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ConfirmAppointmentRequest(
    @NotBlank @Size(max = 32) String bookingCode,
    @NotBlank @Pattern(regexp = "\\d{6}", message = "Mã OTP phải gồm 6 chữ số") String otpCode,
    @Size(max = 2000) String notes
) {
}
