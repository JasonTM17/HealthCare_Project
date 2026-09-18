package com.healthcare.academic.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record GradeAcademicThesisRequest(
    @NotNull(message = "Điểm bảo vệ không được để trống")
    @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0.0")
    @DecimalMax(value = "10.0", message = "Điểm tối đa là 10.0")
    BigDecimal defenseScore,

    String defenseLocation,

    OffsetDateTime defenseDate,

    String submissionNotes
) {}
