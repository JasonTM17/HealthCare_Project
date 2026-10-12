package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PackageRequest(
    @NotBlank @Size(max = 160) String name,
    @NotBlank @Size(max = 180) String slug,
    @Size(max = 2000) String description,
    @Positive BigDecimal price,
    boolean active,
    @Size(max = 500) String imageUrl,
    @PositiveOrZero Long expectedVersion
) {
    public PackageRequest(String name, String slug, String description, BigDecimal price, boolean active) {
        this(name, slug, description, price, active, null, null);
    }
}
