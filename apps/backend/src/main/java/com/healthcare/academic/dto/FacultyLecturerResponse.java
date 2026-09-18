package com.healthcare.academic.dto;

import java.util.UUID;

public record FacultyLecturerResponse(
    UUID id,
    UUID doctorId,
    String doctorName,
    String doctorPhotoUrl,
    String academicRank,
    String academicTitle,
    String department,
    Integer maxTheses,
    Integer currentThesesCount,
    String biography,
    boolean active
) {}
