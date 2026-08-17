package com.healthcare.scheduling.repository;

import com.healthcare.scheduling.entity.DoctorScheduleException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorScheduleExceptionRepository extends JpaRepository<DoctorScheduleException, UUID> {

    @Query("select e from DoctorScheduleException e where e.doctor.id = :doctorId and e.branch.id = :branchId and e.exceptionDate = :date")
    List<DoctorScheduleException> findForDoctorAndBranchOnDate(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("date") LocalDate date
    );
}
