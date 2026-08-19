package com.healthcare.scheduling;

import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.scheduling.entity.DoctorSchedule;
import com.healthcare.scheduling.repository.DoctorScheduleRepository;
import com.healthcare.scheduling.service.DoctorScheduleService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DoctorScheduleServiceTest {

    @Test
    void rejectsOverlappingActiveScheduleForSameDoctorBranchAndEffectiveRange() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId);
        Branch branch = new Branch(); branch.setId(branchId);
        when(doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(branches.findById(branchId)).thenReturn(Optional.of(branch));
        when(assignments.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);

        DoctorSchedule existing = new DoctorSchedule();
        existing.setId(UUID.randomUUID()); existing.setDoctor(doctor); existing.setBranch(branch);
        existing.setDayOfWeek(1); existing.setStartTime(LocalTime.of(8, 0)); existing.setEndTime(LocalTime.of(12, 0));
        existing.setEffectiveFrom(LocalDate.of(2026, 1, 1)); existing.setActive(true);
        when(schedules.findByDoctorIdAndBranchIdAndDayOfWeekAndActiveTrue(doctorId, branchId, 1))
            .thenReturn(List.of(existing));

        DoctorScheduleService service = new DoctorScheduleService(schedules, doctors, assignments, branches);
        DoctorScheduleRequest request = new DoctorScheduleRequest(
            1, LocalTime.of(11, 30), LocalTime.of(15, 0), 30,
            LocalDate.of(2026, 8, 1), null, true);

        assertThatThrownBy(() -> service.createSchedule(doctorId, branchId, request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("overlaps")
            .extracting("status").isEqualTo(409);
    }
}
