package com.healthcare.scheduling.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record DoctorScheduleExceptionRequest(
    @NotNull LocalDate exceptionDate,
    @NotNull @Pattern(regexp = "CUSTOM_HOURS|BLOCKED|LEAVE") String type,
    LocalTime customStartTime,
    LocalTime customEndTime,
    @Size(max = 255) String reason
) {
    @AssertTrue(message = "CUSTOM_HOURS requires a valid start and end time; blocked/leave must not include hours")
    @JsonIgnore
    public boolean isHoursValid() {
        if ("CUSTOM_HOURS".equals(type)) {
            return customStartTime != null && customEndTime != null && customStartTime.isBefore(customEndTime);
        }
        return customStartTime == null && customEndTime == null;
    }
}
