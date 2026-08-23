package com.healthcare.user.dto;

public record RegistrationPendingResponse(
    String email,
    boolean verificationRequired,
    String message,
    long expiresInSeconds,
    long resendAfterSeconds
) {
    public RegistrationPendingResponse(String email, boolean verificationRequired, String message) {
        this(email, verificationRequired, message, 600, 60);
    }
}
