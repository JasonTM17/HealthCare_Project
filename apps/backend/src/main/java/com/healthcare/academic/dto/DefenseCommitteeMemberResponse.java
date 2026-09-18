package com.healthcare.academic.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DefenseCommitteeMemberResponse(
    UUID id,
    UUID thesisId,
    UUID lecturerId,
    String lecturerName,
    String academicRank,
    String department,
    String committeeRole,
    BigDecimal score,
    String evaluationNotes,
    OffsetDateTime evaluatedAt
) {}
