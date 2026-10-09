package com.healthcare.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.OffsetDateTime;

public record AdminAccountActionRequest(@NotNull @PositiveOrZero Long expectedVersion,
                                        @NotNull OffsetDateTime expectedUpdatedAt) { }
