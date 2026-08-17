package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.DateTimeException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ScheduleService {

    private final DoctorScheduleRepository doctorScheduleRepository;
    private final AppointmentRepository appointmentRepository;

    public ScheduleService(DoctorScheduleRepository doctorScheduleRepository,
                           AppointmentRepository appointmentRepository) {
        this.doctorScheduleRepository = doctorScheduleRepository;
        this.appointmentRepository = appointmentRepository;
    }

    /**
     * Computes all 30-minute time slots for a doctor on a specific date, marking occupied slots.
     */
    public List<TimeSlotDto> getAvailableSlots(UUID doctorId, LocalDate date) {
        // Do not return slots for dates in the past
        if (date.isBefore(LocalDate.now())) {
            return Collections.emptyList();
        }

        List<DoctorSchedule> schedules = schedulesForDate(doctorId, date);

        if (schedules.isEmpty()) {
            return Collections.emptyList();
        }

        // Query occupied / held appointments
        OffsetDateTime now = OffsetDateTime.now();
        List<Appointment> occupiedAppointments = appointmentRepository.findAllOccupiedSlots(doctorId, date, now);
        Set<LocalTime> occupiedStartTimes = new HashSet<>();
        for (Appointment appt : occupiedAppointments) {
            occupiedStartTimes.add(appt.getStartTime());
        }

        List<TimeSlotDto> slots = new ArrayList<>();
        LocalTime currentTime = LocalTime.now();
        boolean isToday = date.equals(LocalDate.now());

        for (DoctorSchedule schedule : schedules) {
            LocalTime slotStart = schedule.getStartTime();
            int duration = schedule.getSlotDurationMinutes() > 0 ? schedule.getSlotDurationMinutes() : 30;

            while (slotStart.plusMinutes(duration).isBefore(schedule.getEndTime()) ||
                   slotStart.plusMinutes(duration).equals(schedule.getEndTime())) {
                LocalTime slotEnd = slotStart.plusMinutes(duration);

                // Slot is in the past if today and slotStart is before current time
                boolean isPast = isToday && slotStart.isBefore(currentTime.plusMinutes(15));
                boolean isOccupied = occupiedStartTimes.contains(slotStart);

                boolean available = !isPast && !isOccupied;
                String note = isPast ? "Đã qua giờ khám" : (isOccupied ? "Đã có người đặt / Đang giữ chỗ" : "Còn trống");

                slots.add(new TimeSlotDto(slotStart, slotEnd, available, note));
                slotStart = slotEnd;
            }
        }

        return slots;
    }

    /**
     * Keeps booking writes on the same schedule contract exposed by the slots API.
     * A request must be aligned to a configured slot (or the documented local demo
     * shifts when no custom schedule exists), and cannot target a past slot.
     */
    public boolean isBookableSlot(UUID doctorId, UUID branchId, LocalDate date, LocalTime startTime) {
        if (date == null || startTime == null || date.isBefore(LocalDate.now())) {
            return false;
        }
        if (date.equals(LocalDate.now())
                && LocalDateTime.of(date, startTime).isBefore(LocalDateTime.now().plusMinutes(15))) {
            return false;
        }

        return schedulesForDate(doctorId, date).stream()
            .filter(schedule -> schedule.getBranch() == null
                || (branchId != null && branchId.equals(schedule.getBranch().getId())))
            .anyMatch(schedule -> containsSlot(schedule, startTime));
    }

    private List<DoctorSchedule> schedulesForDate(UUID doctorId, LocalDate date) {
        int dayOfWeekVal = date.getDayOfWeek().getValue(); // 1 = Monday, 7 = Sunday
        List<DoctorSchedule> schedules = doctorScheduleRepository
            .findByDoctorIdAndDayOfWeekAndActiveTrue(doctorId, dayOfWeekVal);

        // If no custom schedule is registered, provide standard clinical shifts (Mon-Sat).
        if (schedules.isEmpty() && date.getDayOfWeek() != DayOfWeek.SUNDAY) {
            return createDefaultShifts(doctorId, dayOfWeekVal);
        }
        return schedules;
    }

    private boolean containsSlot(DoctorSchedule schedule, LocalTime requestedStart) {
        LocalTime scheduleStart = schedule.getStartTime();
        LocalTime scheduleEnd = schedule.getEndTime();
        int duration = schedule.getSlotDurationMinutes();
        if (scheduleStart == null || scheduleEnd == null || duration <= 0 || duration > 1440
                || requestedStart.isBefore(scheduleStart) || !requestedStart.isBefore(scheduleEnd)) {
            return false;
        }

        LocalTime candidate = scheduleStart;
        while (candidate.isBefore(scheduleEnd)) {
            LocalTime candidateEnd;
            try {
                candidateEnd = candidate.plusMinutes(duration);
            } catch (DateTimeException exception) {
                return false;
            }
            if (!candidateEnd.isAfter(candidate)) {
                return false;
            }
            if (candidate.equals(requestedStart)) {
                return !candidateEnd.isAfter(scheduleEnd);
            }
            if (!candidateEnd.isBefore(scheduleEnd)) {
                return false;
            }
            candidate = candidateEnd;
        }
        return false;
    }

    private List<DoctorSchedule> createDefaultShifts(UUID doctorId, int dayOfWeek) {
        List<DoctorSchedule> defaults = new ArrayList<>();

        DoctorSchedule morning = new DoctorSchedule();
        morning.setDayOfWeek(dayOfWeek);
        morning.setStartTime(LocalTime.of(8, 0));
        morning.setEndTime(LocalTime.of(11, 30));
        morning.setSlotDurationMinutes(30);
        defaults.add(morning);

        DoctorSchedule afternoon = new DoctorSchedule();
        afternoon.setDayOfWeek(dayOfWeek);
        afternoon.setStartTime(LocalTime.of(13, 30));
        afternoon.setEndTime(LocalTime.of(17, 0));
        afternoon.setSlotDurationMinutes(30);
        defaults.add(afternoon);

        return defaults;
    }
}
