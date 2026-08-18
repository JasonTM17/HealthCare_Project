package com.healthcare.cms.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public record CmsRollbackRequest(
    @NotNull @Positive Long changeId,
    @NotNull @PositiveOrZero Long expectedVersion
) {
}
