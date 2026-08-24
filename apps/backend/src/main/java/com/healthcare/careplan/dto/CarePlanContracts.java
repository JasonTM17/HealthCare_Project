package com.healthcare.careplan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class CarePlanContracts {
    private CarePlanContracts() {}

    public record ItemRequest(
            @NotBlank @Size(max = 1000) String goal,
            @Size(max = 500) String reminder,
            OffsetDateTime dueAt) {}

    public record CreateRequest(
            @NotNull UUID appointmentId,
            @NotBlank @Size(max = 240) String title,
            @NotEmpty @Size(max = 20) List<@Valid ItemRequest> items) {}

    public record Item(
            UUID id,
            int sequenceNumber,
            String goal,
            String reminder,
            String status,
            OffsetDateTime dueAt,
            OffsetDateTime completedAt) {}

    public record Plan(
            UUID id,
            UUID appointmentId,
            UUID doctorId,
            String doctorName,
            String title,
            String status,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            List<Item> items) {}
}
