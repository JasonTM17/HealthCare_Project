package com.healthcare.appointment.dto;

import java.time.OffsetDateTime;

/** Public, non-sensitive state returned after an OTP resend request. */
public record ResendOtpResponse(
    String bookingCode,
    OffsetDateTime holdExpiresAt,
    OffsetDateTime otpExpiresAt,
    boolean otpRequired,
    OtpDeliveryStatus otpDeliveryStatus,
    String message,
    long retryAfterSeconds
) {
}
