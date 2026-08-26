package com.healthcare.auth.security;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BrowserSessionContext(
    UUID sessionId,
    UUID userId,
    String csrfSecretHash,
    OffsetDateTime idleExpiresAt,
    OffsetDateTime absoluteExpiresAt
) {
}
