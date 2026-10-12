package com.healthcare.hospital.dto;

import java.math.BigDecimal;
import java.util.List;

public record PackageResponse(
    String id,
    String name,
    String slug,
    String description,
    BigDecimal price,
    String targetAudience,
    Integer durationDays,
    List<String> checklist,
    List<String> preparationSteps,
    String imageUrl
) {
    public PackageResponse(String id, String name, String slug, String description, BigDecimal price,
        String targetAudience, Integer durationDays, List<String> checklist, List<String> preparationSteps) {
        this(id, name, slug, description, price, targetAudience, durationDays, checklist, preparationSteps, null);
    }
}
