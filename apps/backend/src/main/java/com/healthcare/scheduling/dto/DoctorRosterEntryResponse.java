package com.healthcare.scheduling.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.healthcare.appointment.entity.DoctorSchedule;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * One weekly roster row as the doctor portal sees it.
 *
 * <p>Deliberately flat and doctor-scoped: no {@code doctorId} / {@code doctorName}
 * because the roster is always the authenticated doctor's own, and no nested
 * branch object. {@code active} is reported rather than filtered, so the portal
 * can show a deactivated row instead of silently hiding the doctor's own
 * configuration.
 *
 * <p>Times are always serialized as {@code HH:mm:ss}. The ISO-8601 default drops
 * the seconds field when it is zero ({@code 09:00}), which makes the wire shape
 * depend on the value; the explicit pattern keeps one shape for every row.
 */
public record DoctorRosterEntryResponse(
    UUID id,
    int dayOfWeek,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss") LocalTime startTime,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss") LocalTime endTime,
    int slotDurationMinutes,
    UUID branchId,
    String branchName,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    boolean active
) {
    public static DoctorRosterEntryResponse from(DoctorSchedule schedule) {
        return new DoctorRosterEntryResponse(
            schedule.getId(),
            schedule.getDayOfWeek(),
            schedule.getStartTime(),
            schedule.getEndTime(),
            schedule.getSlotDurationMinutes(),
            schedule.getBranch() == null ? null : schedule.getBranch().getId(),
            schedule.getBranch() == null ? null : schedule.getBranch().getName(),
            schedule.getEffectiveFrom(),
            schedule.getEffectiveTo(),
            schedule.isActive()
        );
    }
}
