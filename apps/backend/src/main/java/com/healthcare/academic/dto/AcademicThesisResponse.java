package com.healthcare.academic.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AcademicThesisResponse(
    UUID id,
    String topicCode,
    String title,
    String abstractText,
    String academicYear,
    String trainingLevel,
    UUID specialtyId,
    String specialtyName,
    String specialtySlug,
    UUID primarySupervisorId,
    String supervisorName,
    String supervisorRank,
    String department,
    String studentName,
    String studentCode,
    String status,
    BigDecimal defenseScore,
    OffsetDateTime defenseDate,
    String defenseLocation,
    String thesisDocumentUrl,
    String submissionNotes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<DefenseCommitteeMemberResponse> committeeMembers
) {}
