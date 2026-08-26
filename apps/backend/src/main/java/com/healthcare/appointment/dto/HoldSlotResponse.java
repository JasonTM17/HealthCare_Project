package com.healthcare.appointment.dto;

import java.time.OffsetDateTime;

public record HoldSlotResponse(
    String bookingCode,
    OffsetDateTime holdExpiresAt,
    OffsetDateTime otpExpiresAt,
    String message,
    boolean otpRequired,
    OtpDeliveryStatus otpDeliveryStatus
) {
    public HoldSlotResponse(String bookingCode, OffsetDateTime holdExpiresAt,
                            OffsetDateTime otpExpiresAt, String message,
                            boolean otpRequired) {
        this(bookingCode, holdExpiresAt, otpExpiresAt, message, otpRequired,
            otpRequired ? OtpDeliveryStatus.QUEUED : OtpDeliveryStatus.EXPIRED);
    }
}
