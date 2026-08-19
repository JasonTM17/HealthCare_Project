package com.healthcare.appointment.dto;

import java.time.OffsetDateTime;

public record HoldSlotResponse(
    String bookingCode,
    OffsetDateTime holdExpiresAt,
    OffsetDateTime otpExpiresAt,
    String message,
    boolean otpRequired
) {
}
