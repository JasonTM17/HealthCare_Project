package com.healthcare.cms.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CmsPublishRequest(@NotNull @Positive Long expectedVersion) {}
