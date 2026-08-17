package com.healthcare.scheduling.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;

/** API input for a branch-scoped recurring doctor schedule. */
public record DoctorScheduleRequest(
    @NotNull @Min(1) @Max(7) Integer dayOfWeek,
    @NotNull LocalTime startTime,
    @NotNull LocalTime endTime,
    @NotNull @Min(1) @Max(1440) Integer slotDurationMinutes,
    @NotNull LocalDate effectiveFrom,
    LocalDate effectiveTo,
    Boolean active
) {

    @AssertTrue(message = "startTime must be before endTime")
    @JsonIgnore
    public boolean isTimeRangeValid() {
        return startTime == null || endTime == null || startTime.isBefore(endTime);
    }

    @AssertTrue(message = "slotDurationMinutes must fit inside the schedule window")
    @JsonIgnore
    public boolean isDurationValid() {
        return startTime == null || endTime == null || slotDurationMinutes == null
            || (startTime.isBefore(endTime)
                && slotDurationMinutes <= Duration.between(startTime, endTime).toMinutes());
    }

    @AssertTrue(message = "effectiveTo must be on or after effectiveFrom")
    @JsonIgnore
    public boolean isEffectiveRangeValid() {
        return effectiveFrom == null || effectiveTo == null || !effectiveTo.isBefore(effectiveFrom);
    }

    @JsonIgnore
    public boolean activeOrDefault() {
        return active == null || active;
    }
}
