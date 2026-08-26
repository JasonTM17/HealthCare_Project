package com.healthcare.auth.dto;

import com.healthcare.user.dto.AuthResponse;

import java.time.OffsetDateTime;

public record BrowserSessionResponse(
    AuthResponse.UserInfo user,
    OffsetDateTime idleExpiresAt,
    OffsetDateTime absoluteExpiresAt
) {
}
