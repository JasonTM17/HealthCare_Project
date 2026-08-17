package com.healthcare.appointment.dto;

import java.time.LocalTime;

public record TimeSlotDto(
    LocalTime startTime,
    LocalTime endTime,
    boolean available,
    String statusNote
) {}
