package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Availability authority for doctor schedules.
 *
 * <p><strong>Absence of a schedule means closed.</strong> A branch/day without a
 * persisted, active, in-range {@code doctor_schedules} row (or a matching
 * exception that opens custom hours) has no bookable windows, so
 * {@link #getAvailableSlots} and {@link #findBookableSlot} fail closed. The
 * service never invents clinic hours.
 *
 * <p>The only exception is an explicitly flagged local demo fallback:
 * {@code app.demo.default-schedule-windows=true} <em>and</em> an active
 * {@code local} profile. Outside that combination the flag is ignored with a
 * single WARN and availability stays closed.
 */
@Service
@Transactional(readOnly = true)
public class ScheduleService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleService.class);

    private static final int DEFAULT_SLOT_DURATION_MINUTES = 30;
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Opt-in switch for the local-only demo windows; disabled unless explicitly enabled. */
    static final String DEMO_DEFAULT_WINDOWS_PROPERTY = "app.demo.default-schedule-windows";
    private static final String LOCAL_PROFILE = "local";

    private final DoctorScheduleRepository doctorScheduleRepository;
    private final DoctorScheduleExceptionRepository exceptionRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final BranchRepository branchRepository;
    private final Environment environment;
    private final AtomicBoolean demoFallbackMisconfiguredWarned = new AtomicBoolean(false);

    @Autowired
    public ScheduleService(
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorScheduleExceptionRepository exceptionRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            @Nullable DoctorBranchRepository doctorBranchRepository,
            @Nullable BranchRepository branchRepository,
            @Nullable Environment environment) {
        this.doctorScheduleRepository = doctorScheduleRepository;
        this.exceptionRepository = exceptionRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.branchRepository = branchRepository;
        this.environment = environment;
    }

    public ScheduleService(
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorScheduleExceptionRepository exceptionRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            @Nullable DoctorBranchRepository doctorBranchRepository,
            @Nullable BranchRepository branchRepository) {
        this(doctorScheduleRepository, exceptionRepository, appointmentRepository,
            doctorRepository, doctorBranchRepository, branchRepository, null);
    }

    public ScheduleService(
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorScheduleExceptionRepository exceptionRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            @Nullable DoctorBranchRepository doctorBranchRepository) {
        this(doctorScheduleRepository, exceptionRepository, appointmentRepository,
            doctorRepository, doctorBranchRepository, null, null);
    }

    public ScheduleService(
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorScheduleExceptionRepository exceptionRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository) {
        this(doctorScheduleRepository, exceptionRepository, appointmentRepository, doctorRepository, null, null, null);
    }

    /** Computes configured slots and marks every interval overlapping an appointment as occupied. */
    public List<TimeSlotDto> getAvailableSlots(UUID doctorId, LocalDate date) {
        return getAvailableSlots(doctorId, null, date);
    }

    /**
     * Computes slots for one branch when {@code branchId} is supplied. When it
     * is omitted, persisted schedules for every branch are returned and each
     * slot carries its branch id so callers cannot mistake equal clock times
     * from different branches for one slot.
     */
    public List<TimeSlotDto> getAvailableSlots(UUID doctorId, UUID branchId, LocalDate date) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (doctorId == null || date == null || date.isBefore(today)
                || (doctorRepository != null && doctorRepository.findById(doctorId).filter(Doctor::isActive).isEmpty())) {
            return Collections.emptyList();
        }
        if (branchId != null && branchRepository != null
                && !branchRepository.findById(branchId).filter(Branch::isActive).isPresent()) {
            // An inactive branch is no longer part of the bookable catalog even
            // when persisted schedules would still produce windows for it.
            return Collections.emptyList();
        }

        List<ScheduleWindow> windows = scheduleWindowsForDate(doctorId, date, branchId);
        if (windows.isEmpty()) {
            return Collections.emptyList();
        }

        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        Map<UUID, List<Appointment>> occupiedByBranch = new LinkedHashMap<>();
        for (ScheduleWindow window : windows) {
            occupiedByBranch.computeIfAbsent(
                window.branchId(),
                requestedBranchId -> appointmentRepository.findAllOccupiedSlots(
                    doctorId, requestedBranchId, date, now)
            );
        }
        Map<SlotKey, TimeSlotDto> slots = new LinkedHashMap<>();
        LocalTime currentTime = LocalTime.now(BUSINESS_ZONE);
        boolean isToday = date.equals(today);

        for (ScheduleWindow window : windows) {
            LocalTime slotStart = window.startTime();
            while (slotStart.isBefore(window.endTime())) {
                LocalTime slotEnd = addMinutesSafely(slotStart, window.slotDurationMinutes());
                if (slotEnd == null || !slotEnd.isAfter(slotStart) || slotEnd.isAfter(window.endTime())) {
                    break;
                }

                boolean isPast = isToday && slotStart.isBefore(currentTime.plusMinutes(15));
                LocalTime currentSlotStart = slotStart;
                List<Appointment> occupiedAppointments = occupiedByBranch.getOrDefault(window.branchId(), List.of());
                boolean isOccupied = occupiedAppointments.stream()
                    .anyMatch(appointment -> overlaps(currentSlotStart, slotEnd, appointment));
                boolean available = !isPast && !isOccupied;
                String note = isPast
                    ? "Đã qua giờ khám"
                    : (isOccupied ? "Đã có người đặt / Đang giữ chỗ" : "Còn trống");

                SlotKey slotKey = new SlotKey(window.branchId(), slotStart, slotEnd);
                slots.putIfAbsent(
                    slotKey,
                    new TimeSlotDto(window.branchId(), slotStart, slotEnd, available, note)
                );
                slotStart = slotEnd;
            }
        }

        return List.copyOf(slots.values());
    }

    /** Resolves the exact interval used by booking, including configured duration. */
    public Optional<BookableSlot> findBookableSlot(
            UUID doctorId,
            UUID branchId,
            LocalDate date,
            LocalTime requestedStart) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (doctorId == null || date == null || requestedStart == null || date.isBefore(today)) {
            return Optional.empty();
        }
        if (doctorRepository != null
                && doctorRepository.findById(doctorId).filter(Doctor::isActive).isEmpty()) {
            return Optional.empty();
        }
        if (branchId != null && branchRepository != null
                && !branchRepository.findById(branchId).filter(Branch::isActive).isPresent()) {
            return Optional.empty();
        }
        if (date.equals(today)
                && LocalDateTime.of(date, requestedStart).isBefore(LocalDateTime.now(BUSINESS_ZONE).plusMinutes(15))) {
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
        if (doctorId == null || (doctorRepository != null
                && doctorRepository.findById(doctorId).filter(Doctor::isActive).isEmpty())) {
            return Collections.emptyList();
        }
        if (branchId != null && branchRepository != null
                && !branchRepository.findById(branchId).filter(Branch::isActive).isPresent()) {
            return Collections.emptyList();
        }
        int isoDayOfWeek = date.getDayOfWeek().getValue();
        List<DoctorSchedule> schedules = branchId == null
            ? doctorScheduleRepository.findActiveForDoctorOnDate(doctorId, date, isoDayOfWeek)
            : doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(
                doctorId, branchId, date, isoDayOfWeek);

        if (schedules.isEmpty()) {
            if (branchId != null && doctorBranchRepository != null
                    && !doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
                return Collections.emptyList();
            }

            List<DoctorScheduleException> exceptions = branchId == null
                ? Collections.emptyList()
                : exceptionRepository.findForDoctorAndBranchOnDate(doctorId, branchId, date);

            if (exceptions.stream().anyMatch(this::blocksSchedule)) {
                return Collections.emptyList();
            }

            List<DoctorScheduleException> customHours = exceptions.stream()
                .filter(this::isCustomHours)
                .filter(exception -> exception.getCustomStartTime() != null
                    && exception.getCustomEndTime() != null
                    && exception.getCustomStartTime().isBefore(exception.getCustomEndTime()))
                .toList();

            if (!customHours.isEmpty()) {
                List<ScheduleWindow> windows = new ArrayList<>();
                for (DoctorScheduleException exception : customHours) {
                    windows.add(new ScheduleWindow(
                        exception.getCustomStartTime(),
                        exception.getCustomEndTime(),
                        DEFAULT_SLOT_DURATION_MINUTES,
                        branchId
                    ));
                }
                return windows;
            }

            if (branchId == null && doctorBranchRepository != null) {
                List<DoctorBranch> assignments = doctorBranchRepository.findByDoctorId(doctorId);
                if (assignments != null && !assignments.isEmpty()) {
                    List<ScheduleWindow> windows = new ArrayList<>();
                    for (DoctorBranch assignment : assignments) {
                        if (assignment.getBranch() != null && assignment.getBranch().isActive()) {
                            UUID assignedBranchId = assignment.getBranch().getId();
                            List<DoctorScheduleException> branchExceptions = exceptionRepository
                                .findForDoctorAndBranchOnDate(doctorId, assignedBranchId, date);
                            if (branchExceptions.stream().anyMatch(this::blocksSchedule)) {
                                continue;
                            }
                            List<DoctorScheduleException> branchCustomHours = branchExceptions.stream()
                                .filter(this::isCustomHours)
                                .filter(e -> e.getCustomStartTime() != null
                                    && e.getCustomEndTime() != null
                                    && e.getCustomStartTime().isBefore(e.getCustomEndTime()))
                                .toList();
                            if (!branchCustomHours.isEmpty()) {
                                for (DoctorScheduleException exception : branchCustomHours) {
                                    windows.add(new ScheduleWindow(
                                        exception.getCustomStartTime(),
                                        exception.getCustomEndTime(),
                                        DEFAULT_SLOT_DURATION_MINUTES,
                                        assignedBranchId
                                    ));
                                }
                            } else {
                                windows.addAll(demoWindows(assignedBranchId));
                            }
                        }
                    }
                    if (!windows.isEmpty()) {
                        return windows;
                    }
                }
            }

            // No persisted schedule for this branch/day. Closing the day is the
            // authority-bearing answer; only the local demo flag can open it.
            return demoWindows(branchId);
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

    /**
     * Local-demo windows for a branch with no persisted schedule.
     *
     * <p>Returns an empty list in every production configuration: the fallback
     * requires {@code app.demo.default-schedule-windows=true} <em>and</em> an
     * active {@code local} profile. A flag set elsewhere is ignored (and logged
     * once) because an unlocked default would silently re-open clinics that have
     * no schedule.
     */
    private List<ScheduleWindow> demoWindows(UUID branchId) {
        if (!demoDefaultWindowsEnabled()) {
            return Collections.emptyList();
        }
        return List.of(
            new ScheduleWindow(LocalTime.of(8, 0), LocalTime.of(12, 0), DEFAULT_SLOT_DURATION_MINUTES, branchId),
            new ScheduleWindow(LocalTime.of(13, 30), LocalTime.of(17, 30), DEFAULT_SLOT_DURATION_MINUTES, branchId)
        );
    }

    private boolean demoDefaultWindowsEnabled() {
        if (environment == null) {
            return false;
        }
        if (!environment.getProperty(DEMO_DEFAULT_WINDOWS_PROPERTY, Boolean.class, false)) {
            return false;
        }
        if (environment.acceptsProfiles(Profiles.of(LOCAL_PROFILE))) {
            return true;
        }
        if (demoFallbackMisconfiguredWarned.compareAndSet(false, true)) {
            log.warn(
                "{} is enabled but the active profiles {} do not include '{}'; "
                    + "ignoring the flag and keeping days without a persisted schedule closed.",
                DEMO_DEFAULT_WINDOWS_PROPERTY,
                String.join(",", environment.getActiveProfiles()),
                LOCAL_PROFILE
            );
        }
        return false;
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
        // A branchless window is the local/demo fallback only. It must never
        // satisfy a request explicitly scoped to a persisted branch. With the
        // demo flag off (every production profile) no branchless window exists
        // and a branchless request stays closed.
        return Objects.equals(window.branchId(), requestedBranchId);
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

    private record SlotKey(UUID branchId, LocalTime startTime, LocalTime endTime) {
    }
}
