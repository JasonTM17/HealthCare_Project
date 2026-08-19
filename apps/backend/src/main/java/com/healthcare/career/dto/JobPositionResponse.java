package com.healthcare.career.dto;

import java.time.LocalDate;
import java.util.List;

public record JobPositionResponse(
    String id,
    String slug,
    String title,
    String department,
    String location,
    String employmentType,
    String employmentTypeLabel,
    String summary,
    List<String> responsibilities,
    List<String> requirements,
    List<String> benefits,
    LocalDate deadline,
    boolean featured
) {
}
