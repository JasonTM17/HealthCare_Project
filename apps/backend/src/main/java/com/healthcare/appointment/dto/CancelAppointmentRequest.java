package com.healthcare.appointment.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CancelAppointmentRequest(
    @Size(max = 500) String reason,
    @Size(max = 20) @Pattern(regexp = "^[+0-9() .-]+$", message = "Số điện thoại không hợp lệ") String phone
) {
}
