package com.healthcare.auth.dto;

public record GoogleProofResponse(
    String email, long expiresInSeconds, long resendCooldownSeconds, String message
) {}
