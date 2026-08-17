package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ScheduleService {

    private static final int DEFAULT_SLOT_DURATION_MINUTES = 30;

    private final DoctorScheduleRepository doctorScheduleRepository;
    private final DoctorScheduleExceptionRepository exceptionRepository;
    private final AppointmentRepository appointmentRepository;

    public ScheduleService(
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorScheduleExceptionRepository exceptionRepository,
            AppointmentRepository appointmentRepository) {
        this.doctorScheduleRepository = doctorScheduleRepository;
        this.exceptionRepository = exceptionRepository;
        this.appointmentRepository = appointmentRepository;
    }

    /** Computes configured slots and marks every interval overlapping an appointment as occupied. */
    public List<TimeSlotDto> getAvailableSlots(UUID doctorId, LocalDate date) {
        if (date == null || date.isBefore(LocalDate.now())) {
            return Collections.emptyList();
        }

        List<ScheduleWindow> windows = scheduleWindowsForDate(doctorId, date, null);
        if (windows.isEmpty()) {
            return Collections.emptyList();
        }

        OffsetDateTime now = OffsetDateTime.now();
        List<Appointment> occupiedAppointments = appointmentRepository.findAllOccupiedSlots(doctorId, date, now);
        List<TimeSlotDto> slots = new ArrayList<>();
        LocalTime currentTime = LocalTime.now();
        boolean isToday = date.equals(LocalDate.now());

        for (ScheduleWindow window : windows) {
            LocalTime slotStart = window.startTime();
            while (slotStart.isBefore(window.endTime())) {
                LocalTime slotEnd = addMinutesSafely(slotStart, window.slotDurationMinutes());
                if (slotEnd == null || !slotEnd.isAfter(slotStart) || slotEnd.isAfter(window.endTime())) {
                    break;
                }

                boolean isPast = isToday && slotStart.isBefore(currentTime.plusMinutes(15));
                LocalTime currentSlotStart = slotStart;
                boolean isOccupied = occupiedAppointments.stream()
                    .anyMatch(appointment -> overlaps(currentSlotStart, slotEnd, appointment));
                boolean available = !isPast && !isOccupied;
                String note = isPast
                    ? "Đã qua giờ khám"
                    : (isOccupied ? "Đã có người đặt / Đang giữ chỗ" : "Còn trống");

                slots.add(new TimeSlotDto(slotStart, slotEnd, available, note));
                slotStart = slotEnd;
            }
        }

        return slots;
    }

    /** Resolves the exact interval used by booking, including configured duration. */
    public Optional<BookableSlot> findBookableSlot(
            UUID doctorId,
            UUID branchId,
            LocalDate date,
            LocalTime requestedStart) {
        if (date == null || requestedStart == null || date.isBefore(LocalDate.now())) {
            return Optional.empty();
        }
        if (date.equals(LocalDate.now())
                && LocalDateTime.of(date, requestedStart).isBefore(LocalDateTime.now().plusMinutes(15))) {
            return Optional.empty();
        }

        return scheduleWindowsForDate(doctorId, date, branchId).stream()
            .filter(window -> matchesBranch(window, branchId))
            .map(window -> slotEnd(window, requestedStart))
            .flatMap(Optional::stream)
            .findFirst()
            .map(endTime -> new BookableSlot(requestedStart, endTime));
    }

    public boolean isBookableSlot(UUID doctorId, UUID branchId, LocalDate date, LocalTime startTime) {
        return findBookableSlot(doctorId, branchId, date, startTime).isPresent();
    }

    private List<ScheduleWindow> scheduleWindowsForDate(UUID doctorId, LocalDate date, UUID branchId) {
        int isoDayOfWeek = date.getDayOfWeek().getValue();
        List<DoctorSchedule> schedules = branchId == null
            ? doctorScheduleRepository.findActiveForDoctorOnDate(doctorId, date, isoDayOfWeek)
            : doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(
                doctorId, branchId, date, isoDayOfWeek);

        // Only use defaults when the doctor has no active persisted schedule at
        // all. A missing row for one date must not bypass a persisted schedule.
        if (schedules.isEmpty()
                && !doctorScheduleRepository.existsActiveForDoctor(doctorId)
                && date.getDayOfWeek() != DayOfWeek.SUNDAY) {
            return defaultWindows();
        }
        if (schedules.isEmpty()) {
            return Collections.emptyList();
        }

        Map<UUID, List<DoctorSchedule>> schedulesByBranch = new LinkedHashMap<>();
        for (DoctorSchedule schedule : schedules) {
            UUID scheduleBranchId = schedule.getBranch() == null ? null : schedule.getBranch().getId();
            schedulesByBranch.computeIfAbsent(scheduleBranchId, ignored -> new ArrayList<>()).add(schedule);
        }

        List<ScheduleWindow> windows = new ArrayList<>();
        for (Map.Entry<UUID, List<DoctorSchedule>> entry : schedulesByBranch.entrySet()) {
            UUID scheduleBranchId = entry.getKey();
            List<DoctorScheduleException> exceptions = scheduleBranchId == null
                ? Collections.emptyList()
                : exceptionRepository.findForDoctorAndBranchOnDate(doctorId, scheduleBranchId, date);

            if (exceptions.stream().anyMatch(this::blocksSchedule)) {
                continue;
            }

            List<DoctorScheduleException> customHours = exceptions.stream()
                .filter(this::isCustomHours)
                .filter(exception -> exception.getCustomStartTime() != null
                    && exception.getCustomEndTime() != null
                    && exception.getCustomStartTime().isBefore(exception.getCustomEndTime()))
                .toList();

            if (!customHours.isEmpty()) {
                int duration = validDuration(entry.getValue().get(0).getSlotDurationMinutes());
                for (DoctorScheduleException exception : customHours) {
                    windows.add(new ScheduleWindow(
                        exception.getCustomStartTime(),
                        exception.getCustomEndTime(),
                        duration,
                        scheduleBranchId
                    ));
                }
                continue;
            }

            for (DoctorSchedule schedule : entry.getValue()) {
                ScheduleWindow window = toWindow(schedule, scheduleBranchId);
                if (window != null) {
                    windows.add(window);
                }
            }
        }
        return windows;
    }

    private List<ScheduleWindow> defaultWindows() {
        return List.of(
            new ScheduleWindow(LocalTime.of(8, 0), LocalTime.of(11, 30), DEFAULT_SLOT_DURATION_MINUTES, null),
            new ScheduleWindow(LocalTime.of(13, 30), LocalTime.of(17, 0), DEFAULT_SLOT_DURATION_MINUTES, null)
        );
    }

    private ScheduleWindow toWindow(DoctorSchedule schedule, UUID branchId) {
        if (schedule.getStartTime() == null || schedule.getEndTime() == null
                || !schedule.getStartTime().isBefore(schedule.getEndTime())) {
            return null;
        }
        int duration = validDuration(schedule.getSlotDurationMinutes());
        if (duration <= 0) {
            return null;
        }
        return new ScheduleWindow(schedule.getStartTime(), schedule.getEndTime(), duration, branchId);
    }

    private int validDuration(int duration) {
        return duration > 0 && duration <= 1440 ? duration : 0;
    }

    private boolean blocksSchedule(DoctorScheduleException exception) {
        return "BLOCKED".equalsIgnoreCase(exception.getType())
            || "LEAVE".equalsIgnoreCase(exception.getType());
    }

    private boolean isCustomHours(DoctorScheduleException exception) {
        return "CUSTOM_HOURS".equalsIgnoreCase(exception.getType());
    }

    private boolean matchesBranch(ScheduleWindow window, UUID requestedBranchId) {
        // Null branch belongs only to the documented default local/demo shift.
        return window.branchId() == null
            || (requestedBranchId != null && requestedBranchId.equals(window.branchId()));
    }

    private Optional<LocalTime> slotEnd(ScheduleWindow window, LocalTime requestedStart) {
        if (requestedStart.isBefore(window.startTime()) || !requestedStart.isBefore(window.endTime())) {
            return Optional.empty();
        }

        LocalTime candidate = window.startTime();
        while (candidate.isBefore(window.endTime())) {
            LocalTime candidateEnd = addMinutesSafely(candidate, window.slotDurationMinutes());
            if (candidateEnd == null || !candidateEnd.isAfter(candidate) || candidateEnd.isAfter(window.endTime())) {
                return Optional.empty();
            }
            if (candidate.equals(requestedStart)) {
                return Optional.of(candidateEnd);
            }
            candidate = candidateEnd;
        }
        return Optional.empty();
    }

    private LocalTime addMinutesSafely(LocalTime start, int minutes) {
        try {
            return start.plusMinutes(minutes);
        } catch (DateTimeException exception) {
            return null;
        }
    }

    private boolean overlaps(LocalTime slotStart, LocalTime slotEnd, Appointment appointment) {
        LocalTime appointmentStart = appointment.getStartTime();
        LocalTime appointmentEnd = appointment.getEndTime();
        if (appointmentStart == null) {
            return false;
        }
        if (appointmentEnd == null) {
            appointmentEnd = addMinutesSafely(appointmentStart, DEFAULT_SLOT_DURATION_MINUTES);
        }
        return appointmentEnd != null
            && appointmentStart.isBefore(slotEnd)
            && appointmentEnd.isAfter(slotStart);
    }

    public record BookableSlot(LocalTime startTime, LocalTime endTime) {
    }

    private record ScheduleWindow(
            LocalTime startTime,
            LocalTime endTime,
            int slotDurationMinutes,
            UUID branchId) {
    }
}
