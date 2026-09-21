package com.healthcare.scheduling.service;

import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.scheduling.dto.DoctorScheduleResponse;
import com.healthcare.scheduling.repository.DoctorScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Service
public class DoctorScheduleService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /**
     * Upper bound used when a schedule is open-ended. Far enough to cover every
     * bookable date, still inside PostgreSQL's date range.
     */
    private static final LocalDate OPEN_ENDED_LAST_DATE = LocalDate.of(9999, 12, 31);

    private final DoctorScheduleRepository scheduleRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final BranchRepository branchRepository;
    private final AppointmentRepository appointmentRepository;

    public DoctorScheduleService(
            DoctorScheduleRepository scheduleRepository,
            DoctorRepository doctorRepository,
            DoctorBranchRepository doctorBranchRepository,
            BranchRepository branchRepository,
            AppointmentRepository appointmentRepository) {
        this.scheduleRepository = scheduleRepository;
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.branchRepository = branchRepository;
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional
    public DoctorSchedule createSchedule(UUID doctorId, UUID branchId, DoctorScheduleRequest request) {
        Doctor doctor = doctorRepository.findByIdForUpdate(doctorId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + doctorId));
        Branch branch = branchRepository.findById(branchId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Branch not found: " + branchId));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
            throw new BusinessException(400, "Doctor is not assigned to branch: " + branchId);
        }
        validate(request);
        rejectOverlap(null, doctorId, request);
        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setDoctor(doctor);
        schedule.setBranch(branch);
        applyFields(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @Transactional(readOnly = true)
    public Page<DoctorScheduleResponse> listSchedules(Pageable pageable) {
        return scheduleRepository.findAllWithDetails(pageable).map(DoctorScheduleResponse::from);
    }

    @Transactional
    public DoctorSchedule updateSchedule(UUID scheduleId, DoctorScheduleRequest request) {
        return updateSchedule(scheduleId, request, false);
    }

    @Transactional
    public DoctorSchedule updateSchedule(UUID scheduleId, DoctorScheduleRequest request, boolean force) {
        validate(request);
        lockScheduleDoctor(scheduleId);
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        UUID doctorId = schedule.getDoctor().getId();
        UUID branchId = schedule.getBranch().getId();
        rejectOverlap(scheduleId, doctorId, request);
        rejectLiveBookings(
            doctorId,
            branchId,
            request.dayOfWeek(),
            request.effectiveFrom(),
            request.effectiveTo(),
            force
        );
        applyFields(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void deleteSchedule(UUID scheduleId) {
        deleteSchedule(scheduleId, false);
    }

    @Transactional
    public void deleteSchedule(UUID scheduleId, boolean force) {
        lockScheduleDoctor(scheduleId);
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        rejectLiveBookings(
            schedule.getDoctor().getId(),
            schedule.getBranch().getId(),
            schedule.getDayOfWeek(),
            schedule.getEffectiveFrom(),
            schedule.getEffectiveTo(),
            force
        );
        scheduleRepository.delete(schedule);
    }

    private void lockScheduleDoctor(UUID scheduleId) {
        // Resolve only the stable owner before waiting; load mutable schedule state after the lock.
        UUID doctorId = scheduleRepository.findDoctorIdByScheduleId(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        doctorRepository.findByIdForUpdate(doctorId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + doctorId));
    }

    /**
     * Refuses a change that would close or shrink hours the clinic already sold.
     *
     * <p>Only dates from today on are counted: appointments in the past cannot be
     * orphaned by closing a schedule, and counting them would make every edit of
     * a long-running schedule demand {@code force=true}. The date window is
     * deliberately clamped here instead of inside the query so the predicate
     * stays bounded for open-ended schedules.
     */
    private void rejectLiveBookings(
            UUID doctorId,
            UUID branchId,
            Integer dayOfWeek,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            boolean force) {
        if (force) {
            return;
        }
        LocalDate from = effectiveFrom != null && effectiveFrom.isAfter(LocalDate.now(BUSINESS_ZONE))
            ? effectiveFrom
            : LocalDate.now(BUSINESS_ZONE);
        LocalDate to = effectiveTo != null ? effectiveTo : OPEN_ENDED_LAST_DATE;
        if (to.isBefore(from)) {
            // The affected window is entirely in the past; nothing can be stranded.
            return;
        }
        long activeBookings = appointmentRepository.countActiveBookingsForWeekday(
            doctorId,
            branchId,
            from,
            to,
            dayOfWeek
        );
        if (activeBookings > 0) {
            throw new BusinessException(
                409,
                com.healthcare.exception.ErrorCodes.SCHEDULE_HAS_ACTIVE_BOOKINGS,
                "Còn " + activeBookings + " lịch hẹn đang hoạt động trong khung giờ này. "
                    + "Vui lòng xử lý các lịch hẹn trước, hoặc gửi lại yêu cầu với tham số force=true."
            );
        }
    }

    private void validate(DoctorScheduleRequest request) {
        if (request == null
                || request.dayOfWeek() == null
                || request.dayOfWeek() < 1
                || request.dayOfWeek() > 7
                || request.startTime() == null
                || request.endTime() == null
                || !request.startTime().isBefore(request.endTime())
                || request.slotDurationMinutes() == null
                || request.slotDurationMinutes() <= 0
                || request.slotDurationMinutes() > 1440
                || request.slotDurationMinutes() > Duration.between(request.startTime(), request.endTime()).toMinutes()
                || request.effectiveFrom() == null
                || (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom()))) {
            throw new BusinessException(400, "Invalid doctor schedule: day, time, duration, or effective range");
        }
    }

    private void applyFields(DoctorSchedule schedule, DoctorScheduleRequest request) {
        schedule.setDayOfWeek(request.dayOfWeek());
        schedule.setStartTime(request.startTime());
        schedule.setEndTime(request.endTime());
        schedule.setSlotDurationMinutes(request.slotDurationMinutes());
        schedule.setEffectiveFrom(request.effectiveFrom());
        schedule.setEffectiveTo(request.effectiveTo());
        schedule.setActive(request.activeOrDefault());
    }

    /**
     * One physician cannot be in two places at once, so an overlap is rejected
     * across every branch the doctor works at — the V10 assignment check keeps
     * schedules branch-scoped, but it never made the doctor's own clock global.
     */
    private void rejectOverlap(UUID currentScheduleId, UUID doctorId, DoctorScheduleRequest request) {
        if (Boolean.FALSE.equals(request.active())) return;
        boolean overlap = scheduleRepository
            .findActiveForDoctorOnWeekday(doctorId, request.dayOfWeek())
            .stream()
            .filter(existing -> currentScheduleId == null || !existing.getId().equals(currentScheduleId))
            .anyMatch(existing ->
                request.startTime().isBefore(existing.getEndTime())
                    && request.endTime().isAfter(existing.getStartTime())
                    && (existing.getEffectiveTo() == null || !existing.getEffectiveTo().isBefore(request.effectiveFrom()))
                    && (request.effectiveTo() == null || !request.effectiveTo().isBefore(existing.getEffectiveFrom()))
            );
        if (overlap) {
            throw new BusinessException(409, "Doctor schedule overlaps an existing active schedule");
        }
    }
}
