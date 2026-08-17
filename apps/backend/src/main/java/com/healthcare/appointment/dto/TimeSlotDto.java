package com.healthcare.appointment.dto;

import java.time.LocalTime;
import java.util.UUID;

public record TimeSlotDto(
    UUID branchId,
    LocalTime startTime,
    LocalTime endTime,
    boolean available,
    String statusNote
) {

    /**
     * Keeps the legacy constructor source-compatible for internal callers that
     * represent the local/demo schedule without a persisted branch.
     */
    public TimeSlotDto(
            LocalTime startTime,
            LocalTime endTime,
            boolean available,
            String statusNote) {
        this(null, startTime, endTime, available, statusNote);
    }
}
