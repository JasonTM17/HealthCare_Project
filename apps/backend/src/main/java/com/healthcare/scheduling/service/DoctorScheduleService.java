package com.healthcare.scheduling.service;

import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.entity.DoctorSchedule;
import com.healthcare.scheduling.repository.DoctorScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DoctorScheduleService {

    private final DoctorScheduleRepository scheduleRepository;
    private final DoctorRepository doctorRepository;
    private final BranchRepository branchRepository;

    public DoctorScheduleService(DoctorScheduleRepository scheduleRepository, DoctorRepository doctorRepository, BranchRepository branchRepository) {
        this.scheduleRepository = scheduleRepository;
        this.doctorRepository = doctorRepository;
        this.branchRepository = branchRepository;
    }

    @Transactional
    public DoctorSchedule createSchedule(UUID doctorId, UUID branchId, DoctorSchedule schedule) {
        Doctor doctor = doctorRepository.findById(doctorId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + doctorId));
        Branch branch = branchRepository.findById(branchId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Branch not found: " + branchId));
        schedule.setDoctor(doctor);
        schedule.setBranch(branch);
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public DoctorSchedule updateSchedule(UUID scheduleId, DoctorSchedule updated) {
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        schedule.setDayOfWeek(updated.getDayOfWeek());
        schedule.setStartTime(updated.getStartTime());
        schedule.setEndTime(updated.getEndTime());
        schedule.setSlotDurationMinutes(updated.getSlotDurationMinutes());
        schedule.setEffectiveFrom(updated.getEffectiveFrom());
        schedule.setEffectiveTo(updated.getEffectiveTo());
        schedule.setActive(updated.isActive());
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void deleteSchedule(UUID scheduleId) {
        DoctorSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Schedule not found: " + scheduleId));
        scheduleRepository.delete(schedule);
    }
}
