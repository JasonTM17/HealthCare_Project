package com.healthcare.scheduling.dto;

import com.healthcare.scheduling.entity.DoctorSchedule;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record DoctorScheduleResponse(
    UUID id,
    UUID doctorId,
    String doctorName,
    UUID branchId,
    String branchName,
    int dayOfWeek,
    LocalTime startTime,
    LocalTime endTime,
    int slotDurationMinutes,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    boolean active
) {
    public static DoctorScheduleResponse from(DoctorSchedule schedule) {
        return new DoctorScheduleResponse(
            schedule.getId(), schedule.getDoctor().getId(), schedule.getDoctor().getFullName(),
            schedule.getBranch().getId(), schedule.getBranch().getName(), schedule.getDayOfWeek(),
            schedule.getStartTime(), schedule.getEndTime(), schedule.getSlotDurationMinutes(),
            schedule.getEffectiveFrom(), schedule.getEffectiveTo(), schedule.isActive()
        );
    }
}
