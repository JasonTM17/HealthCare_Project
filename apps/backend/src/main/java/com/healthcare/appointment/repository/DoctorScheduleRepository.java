package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, UUID> {
    List<DoctorSchedule> findByDoctorIdAndActiveTrue(UUID doctorId);
    List<DoctorSchedule> findByDoctorIdAndDayOfWeekAndActiveTrue(UUID doctorId, int dayOfWeek);
    List<DoctorSchedule> findByBranchIdAndActiveTrue(UUID branchId);
}
