package com.healthcare.feedback.dto;

import com.healthcare.feedback.entity.FeedbackCategory;
import com.healthcare.feedback.entity.FeedbackStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FeedbackItemResponse(
    UUID id,
    FeedbackCategory category,
    String subject,
    String message,
    FeedbackStatus status,
    OffsetDateTime createdAt
) {}
