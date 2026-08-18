package com.healthcare.scheduling.dto;

import com.healthcare.scheduling.entity.DoctorScheduleException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record DoctorScheduleExceptionResponse(
    UUID id, UUID doctorId, String doctorName, UUID branchId, String branchName,
    LocalDate exceptionDate, String type, LocalTime customStartTime, LocalTime customEndTime, String reason
) {
    public static DoctorScheduleExceptionResponse from(DoctorScheduleException item) {
        return new DoctorScheduleExceptionResponse(
            item.getId(), item.getDoctor().getId(), item.getDoctor().getFullName(),
            item.getBranch().getId(), item.getBranch().getName(), item.getExceptionDate(),
            item.getType(), item.getCustomStartTime(), item.getCustomEndTime(), item.getReason()
        );
    }
}
