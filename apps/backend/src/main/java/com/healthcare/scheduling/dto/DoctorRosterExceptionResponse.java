package com.healthcare.scheduling.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.healthcare.scheduling.entity.DoctorScheduleException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * One schedule exception (leave, shift change, custom hours) as the doctor
 * portal sees it.
 *
 * <p>Flat and doctor-scoped, and named for what the portal shows: the persisted
 * {@code customStartTime} / {@code customEndTime} / {@code reason} columns are
 * exposed as {@code startTime} / {@code endTime} / {@code note}, matching the
 * vocabulary of the roster shape next to it. {@code type} stays the raw stored
 * code (for example {@code LEAVE}) because the portal must not invent a label
 * the database does not have.
 */
public record DoctorRosterExceptionResponse(
    UUID id,
    LocalDate exceptionDate,
    String type,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss") LocalTime startTime,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss") LocalTime endTime,
    String note,
    UUID branchId,
    String branchName
) {
    public static DoctorRosterExceptionResponse from(DoctorScheduleException exception) {
        return new DoctorRosterExceptionResponse(
            exception.getId(),
            exception.getExceptionDate(),
            exception.getType(),
            exception.getCustomStartTime(),
            exception.getCustomEndTime(),
            exception.getReason(),
            exception.getBranch() == null ? null : exception.getBranch().getId(),
            exception.getBranch() == null ? null : exception.getBranch().getName()
        );
    }
}
