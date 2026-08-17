package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository("appointmentDoctorScheduleRepository")
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, UUID> {
    List<DoctorSchedule> findByDoctorIdAndActiveTrue(UUID doctorId);
    List<DoctorSchedule> findByDoctorIdAndDayOfWeekAndActiveTrue(UUID doctorId, int dayOfWeek);
    List<DoctorSchedule> findByBranchIdAndActiveTrue(UUID branchId);

    @Query("""
        select s from AppointmentDoctorSchedule s
        where s.doctor.id = :doctorId
          and s.active = true
          and s.effectiveFrom <= :date
          and (s.effectiveTo is null or s.effectiveTo >= :date)
          and s.dayOfWeek = :dayOfWeek
        order by s.startTime
    """)
    List<DoctorSchedule> findActiveForDoctorOnDate(
        @Param("doctorId") UUID doctorId,
        @Param("date") LocalDate date,
        @Param("dayOfWeek") int dayOfWeek
    );

    @Query("""
        select s from AppointmentDoctorSchedule s
        where s.doctor.id = :doctorId
          and s.branch.id = :branchId
          and s.active = true
          and s.effectiveFrom <= :date
          and (s.effectiveTo is null or s.effectiveTo >= :date)
          and s.dayOfWeek = :dayOfWeek
        order by s.startTime
    """)
    List<DoctorSchedule> findActiveForDoctorAndBranchOnDate(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("date") LocalDate date,
        @Param("dayOfWeek") int dayOfWeek
    );

    @Query("select count(s) > 0 from AppointmentDoctorSchedule s where s.doctor.id = :doctorId and s.active = true")
    boolean existsActiveForDoctor(@Param("doctorId") UUID doctorId);
}
