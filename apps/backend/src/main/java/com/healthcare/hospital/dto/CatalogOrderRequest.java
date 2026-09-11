package com.healthcare.hospital.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CatalogOrderRequest(@NotEmpty @Size(max = 500) List<@Valid Item> items) {
    public record Item(@NotNull UUID id, @NotNull @PositiveOrZero Long version) {}
}
