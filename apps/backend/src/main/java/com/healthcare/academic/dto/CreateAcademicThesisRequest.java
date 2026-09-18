package com.healthcare.academic.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateAcademicThesisRequest(
    @NotBlank(message = "Mã đề tài không được để trống")
    @Size(max = 60, message = "Mã đề tài tối đa 60 ký tự")
    String topicCode,

    @NotBlank(message = "Tên đề tài không được để trống")
    @Size(max = 300, message = "Tên đề tài tối đa 300 ký tự")
    String title,

    String abstractText,

    @NotBlank(message = "Năm học không được để trống")
    String academicYear,

    @NotBlank(message = "Bậc đào tạo không được để trống")
    String trainingLevel, // GRADUATION_THESIS, RESIDENCY_DISSERTATION, MASTER_THESIS

    UUID specialtyId,

    @NotBlank(message = "Họ tên sinh viên / học viên không được để trống")
    @Size(max = 160, message = "Tên sinh viên tối đa 160 ký tự")
    String studentName,

    @NotBlank(message = "Mã số sinh viên / học viên không được để trống")
    @Size(max = 50, message = "Mã số sinh viên tối đa 50 ký tự")
    String studentCode,

    String thesisDocumentUrl,

    String submissionNotes
) {}
