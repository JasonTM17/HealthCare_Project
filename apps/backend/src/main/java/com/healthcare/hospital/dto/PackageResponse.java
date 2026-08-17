package com.healthcare.hospital.dto;

import java.math.BigDecimal;

public record PackageResponse(String id, String name, String slug, String description, BigDecimal price) {
}
