package com.healthcare.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsPublicationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CmsContentRequest(
    @NotNull CmsComponentType componentType,
    @NotNull JsonNode payload,
    @NotNull CmsPublicationStatus status,
    @NotNull @PositiveOrZero Long expectedVersion
) {
}
