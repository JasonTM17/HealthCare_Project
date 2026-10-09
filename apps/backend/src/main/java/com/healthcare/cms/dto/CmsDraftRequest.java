package com.healthcare.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.entity.CmsComponentType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CmsDraftRequest(
    @NotNull CmsComponentType componentType,
    @NotNull JsonNode payload,
    @NotNull @PositiveOrZero Long expectedVersion
) {}
