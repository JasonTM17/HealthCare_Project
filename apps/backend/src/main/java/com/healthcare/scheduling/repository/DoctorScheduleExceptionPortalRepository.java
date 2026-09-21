package com.healthcare.scheduling.repository;

import com.healthcare.scheduling.entity.DoctorScheduleException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Doctor-scoped read of schedule exceptions (leave, shift changes).
 *
 * <p>Separate from {@code DoctorScheduleExceptionRepository} for the same
 * reason as {@link DoctorSchedulePortalRepository}: the admin listing is
 * cross-doctor and paged, this one is always scoped to the authenticated
 * doctor's own rows.
 */
@Repository("doctorScheduleExceptionPortalRepository")
public interface DoctorScheduleExceptionPortalRepository
        extends JpaRepository<DoctorScheduleException, UUID> {

    /**
     * Most recent exceptions first. Results are always handed a bounded
     * {@link Pageable} by the caller so a single doctor with a long leave
     * history cannot turn this read into an unbounded response.
     */
    @Query("""
        select e from DoctorScheduleException e join fetch e.branch
        where e.doctor.id = :doctorId
        order by e.exceptionDate desc, e.id desc
        """)
    List<DoctorScheduleException> findExceptionsForDoctor(
        @Param("doctorId") UUID doctorId, Pageable limit);
}
