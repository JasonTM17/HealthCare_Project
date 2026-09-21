package com.healthcare.scheduling.repository;

import com.healthcare.appointment.entity.DoctorSchedule;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Doctor-scoped read of the weekly roster.
 *
 * <p>Kept separate from {@code DoctorScheduleRepository} on purpose: the
 * administration repository serves the paged, cross-doctor admin listing,
 * while this one answers "what is my own roster" for the authenticated doctor
 * and is never reachable with a caller-supplied doctor id. Both map the same
 * {@code AppointmentDoctorSchedule} entity, so no second persistence model
 * exists — only a second, narrower query surface.
 */
@Repository("doctorSchedulePortalRepository")
public interface DoctorSchedulePortalRepository extends JpaRepository<DoctorSchedule, UUID> {

    /**
     * Every roster row of one doctor, active and inactive, so the portal can
     * show what is configured rather than only what is currently in force.
     * {@code branch} is fetched because the response carries the branch name;
     * without it each row would trigger its own lazy select.
     */
    @Query("""
        select s from AppointmentDoctorSchedule s join fetch s.branch
        where s.doctor.id = :doctorId
        order by s.dayOfWeek asc, s.startTime asc, s.id asc
        """)
    List<DoctorSchedule> findRosterForDoctor(@Param("doctorId") UUID doctorId, Pageable limit);
}
