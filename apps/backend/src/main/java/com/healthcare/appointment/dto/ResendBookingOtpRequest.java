package com.healthcare.appointment.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Optional identity proof for an unauthenticated booking owner. Authenticated
 * patients should omit the phone number; the server resolves ownership from
 * the session rather than trusting a client supplied user id.
 */
public record ResendBookingOtpRequest(
    // Optional because an authenticated patient omits it, but constrained to the
    // same shape as HoldSlotRequest.phone so a malformed value is rejected as a
    // validation error rather than travelling into the ownership lookup. It was
    // the only public booking field with no constraints at all.
    @Size(min = 7, max = 20)
    @Pattern(regexp = "^[+0-9() .-]+$", message = "Số điện thoại không hợp lệ") String phone
) {
}
