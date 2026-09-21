package com.healthcare.scheduling.service;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionRequest;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionResponse;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Service
public class DoctorScheduleExceptionService {
    private final DoctorScheduleExceptionRepository repository;
    private final DoctorRepository doctorRepository;
    private final BranchRepository branchRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final AppointmentRepository appointmentRepository;

    public DoctorScheduleExceptionService(DoctorScheduleExceptionRepository repository,
            DoctorRepository doctorRepository, BranchRepository branchRepository,
            DoctorBranchRepository doctorBranchRepository, AppointmentRepository appointmentRepository) {
        this.repository = repository;
        this.doctorRepository = doctorRepository;
        this.branchRepository = branchRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional(readOnly = true)
    public Page<DoctorScheduleExceptionResponse> list(Pageable pageable) {
        return repository.findAllWithDetails(pageable).map(DoctorScheduleExceptionResponse::from);
    }

    @Transactional
    public DoctorScheduleExceptionResponse create(UUID doctorId, UUID branchId, DoctorScheduleExceptionRequest request) {
        return create(doctorId, branchId, request, false);
    }

    @Transactional
    public DoctorScheduleExceptionResponse create(
            UUID doctorId, UUID branchId, DoctorScheduleExceptionRequest request, boolean force) {
        // Lock the physician first: the live-booking guard below reads a count
        // and then writes, so concurrent exception writes for one doctor have to
        // serialize on the same row.
        Doctor doctor = doctorRepository.findByIdForUpdate(doctorId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + doctorId));
        Branch branch = branchRepository.findById(branchId)
            .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
            throw new BusinessException(400, "Doctor is not assigned to branch: " + branchId);
        }
        rejectLiveBookings(doctorId, branchId, Set.of(request.exceptionDate()), force);
        DoctorScheduleException item = new DoctorScheduleException();
        item.setDoctor(doctor); item.setBranch(branch); apply(item, request);
        return DoctorScheduleExceptionResponse.from(repository.saveAndFlush(item));
    }

    @Transactional
    public DoctorScheduleExceptionResponse update(UUID id, DoctorScheduleExceptionRequest request) {
        return update(id, request, false);
    }

    @Transactional
    public DoctorScheduleExceptionResponse update(UUID id, DoctorScheduleExceptionRequest request, boolean force) {
        DoctorScheduleException item = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Schedule exception not found: " + id));
        UUID doctorId = item.getDoctor().getId();
        UUID branchId = item.getBranch().getId();
        // Same owner lock and assignment check as create: an exception may only
        // exist for a doctor who actually works at that branch, and the update
        // must not race a concurrent create/update for the same doctor.
        doctorRepository.findByIdForUpdate(doctorId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + doctorId));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
            throw new BusinessException(400, "Doctor is not assigned to branch: " + branchId);
        }
        // Moving an exception touches two days: the day being vacated and the day
        // being claimed. Both have to be free of live bookings.
        Set<LocalDate> affectedDates = new LinkedHashSet<>();
        affectedDates.add(request.exceptionDate());
        if (item.getExceptionDate() != null) {
            affectedDates.add(item.getExceptionDate());
        }
        rejectLiveBookings(doctorId, branchId, affectedDates, force);
        apply(item, request);
        return DoctorScheduleExceptionResponse.from(repository.saveAndFlush(item));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) throw new ResourceNotFoundException("Schedule exception not found: " + id);
        repository.deleteById(id);
    }

    /**
     * A leave/blocked row (or any exception that replaces the day's hours) must
     * not silently strand appointments that are already booked. The caller can
     * override with {@code force}.
     */
    private void rejectLiveBookings(UUID doctorId, UUID branchId, Set<LocalDate> affectedDates, boolean force) {
        if (force) {
            return;
        }
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        for (LocalDate date : affectedDates) {
            if (date == null || date.isBefore(today)) {
                continue;
            }
            long activeBookings = appointmentRepository.countActiveBookingsForWeekday(
                doctorId,
                branchId,
                date,
                date,
                date.getDayOfWeek().getValue()
            );
            if (activeBookings > 0) {
                throw new BusinessException(
                    409,
                    ErrorCodes.SCHEDULE_HAS_ACTIVE_BOOKINGS,
                    "Ngày " + date + " còn " + activeBookings + " lịch hẹn đang hoạt động. "
                        + "Vui lòng xử lý các lịch hẹn trước, hoặc gửi lại yêu cầu với tham số force=true."
                );
            }
        }
    }

    private void apply(DoctorScheduleException item, DoctorScheduleExceptionRequest request) {
        item.setExceptionDate(request.exceptionDate());
        item.setType(request.type());
        item.setCustomStartTime(request.customStartTime());
        item.setCustomEndTime(request.customEndTime());
        item.setReason(request.reason() == null || request.reason().isBlank() ? null : request.reason().trim());
    }
}
