package com.healthcare.scheduling.service;

import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.entity.DoctorSchedule;
import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.scheduling.repository.DoctorScheduleRepository;
import com.healthcare.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.UUID;

@Service
public class DoctorScheduleService {

    private final DoctorScheduleRepository scheduleRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final BranchRepository branchRepository;

    public DoctorScheduleService(
            DoctorScheduleRepository scheduleRepository,
            DoctorRepository doctorRepository,
            DoctorBranchRepository doctorBranchRepository,
            BranchRepository branchRepository) {
        this.scheduleRepository = scheduleRepository;
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.branchRepository = branchRepository;
    }

    @Transactional
    public DoctorSchedule createSchedule(UUID doctorId, UUID branchId, DoctorScheduleRequest request) {
        Doctor doctor = doctorRepository.findById(doctorId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + doctorId));
        Branch branch = branchRepository.findById(branchId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Branch not found: " + branchId));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
            throw new BusinessException(400, "Doctor is not assigned to branch: " + branchId);
        }
        validate(request);
        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setDoctor(doctor);
        schedule.setBranch(branch);
        applyFields(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public DoctorSchedule updateSchedule(UUID scheduleId, DoctorScheduleRequest request) {
        validate(request);
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        applyFields(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void deleteSchedule(UUID scheduleId) {
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        scheduleRepository.delete(schedule);
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
}
