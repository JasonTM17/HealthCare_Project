package com.healthcare.scheduling.repository;

import com.healthcare.scheduling.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository("schedulingDoctorScheduleRepository")
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, UUID> {

    @Query("select s from SchedulingDoctorSchedule s where s.doctor.id = :doctorId and s.branch.id = :branchId and s.active = true and s.effectiveFrom <= :date and (s.effectiveTo is null or s.effectiveTo >= :date) and s.dayOfWeek = :dayOfWeek")
    List<DoctorSchedule> findActiveForDoctorAndBranchOnDay(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("date") LocalDate date,
        @Param("dayOfWeek") DayOfWeek dayOfWeek
    );
}
