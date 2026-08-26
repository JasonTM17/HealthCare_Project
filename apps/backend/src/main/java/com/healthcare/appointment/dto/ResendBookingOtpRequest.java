package com.healthcare.appointment.dto;

/**
 * Optional identity proof for an unauthenticated booking owner. Authenticated
 * patients should omit the phone number; the server resolves ownership from
 * the session rather than trusting a client supplied user id.
 */
public record ResendBookingOtpRequest(String phone) {
}
