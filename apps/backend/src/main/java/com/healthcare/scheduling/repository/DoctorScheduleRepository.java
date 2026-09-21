package com.healthcare.scheduling.repository;

import com.healthcare.appointment.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository("schedulingDoctorScheduleRepository")
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, UUID> {

    @Query("select s.doctor.id from AppointmentDoctorSchedule s where s.id = :id")
    java.util.Optional<UUID> findDoctorIdByScheduleId(@Param("id") UUID id);

    @Query(value = "select s from AppointmentDoctorSchedule s join fetch s.doctor join fetch s.branch",
        countQuery = "select count(s) from AppointmentDoctorSchedule s")
    Page<DoctorSchedule> findAllWithDetails(Pageable pageable);

    List<DoctorSchedule> findByDoctorIdAndBranchIdAndDayOfWeekAndActiveTrue(
        UUID doctorId, UUID branchId, int dayOfWeek);

    /**
     * Every active schedule of one physician on a weekday, regardless of branch.
     * Overlap protection has to see all of them: a doctor cannot work two
     * branches at the same clock time.
     */
    @Query("select s from AppointmentDoctorSchedule s where s.doctor.id = :doctorId and s.dayOfWeek = :dayOfWeek and s.active = true")
    List<DoctorSchedule> findActiveForDoctorOnWeekday(
        @Param("doctorId") UUID doctorId,
        @Param("dayOfWeek") int dayOfWeek
    );

    @Query("select s from AppointmentDoctorSchedule s where s.doctor.id = :doctorId and s.branch.id = :branchId and s.active = true and s.effectiveFrom <= :date and (s.effectiveTo is null or s.effectiveTo >= :date) and s.dayOfWeek = :dayOfWeek")
    List<DoctorSchedule> findActiveForDoctorAndBranchOnDay(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("date") LocalDate date,
        @Param("dayOfWeek") int dayOfWeek
    );
}
