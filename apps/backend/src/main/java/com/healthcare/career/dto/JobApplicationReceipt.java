package com.healthcare.career.dto;

import java.time.OffsetDateTime;

public record JobApplicationReceipt(
    String applicationCode,
    String jobTitle,
    OffsetDateTime submittedAt,
    String message
) {
}
