package com.healthcare.academic.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateAcademicThesisRequest(
    @NotBlank(message = "Tên đề tài không được để trống")
    @Size(max = 300, message = "Tên đề tài tối đa 300 ký tự")
    String title,

    String abstractText,

    String academicYear,

    String trainingLevel,

    UUID specialtyId,

    String studentName,

    String studentCode,

    String status,

    String thesisDocumentUrl,

    String submissionNotes
) {}
