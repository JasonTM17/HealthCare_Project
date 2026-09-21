package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Date-range reads for the doctor portal.
 *
 * <p>Kept apart from {@code AppointmentRepository} so the range capability is
 * additive: the single-day queries the doctor portal already shipped stay
 * byte-identical, and the two repository interfaces over the same entity never
 * have to be reconciled in one diff.
 *
 * <p>The range is always bounded by the service (at most 31 days) before it
 * reaches here; these queries assume closed, validated bounds.
 */
@Repository("doctorAppointmentRangeRepository")
public interface DoctorAppointmentRangeRepository extends JpaRepository<Appointment, UUID> {

    /** Range read for one doctor. Every to-one field the response needs is fetched in one query. */
    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate >= :fromDate
          and a.appointmentDate <= :toDate
        """)
    Page<Appointment> findRangeForDoctor(
        @Param("doctorId") UUID doctorId,
        @Param("fromDate") LocalDate fromDate,
        @Param("toDate") LocalDate toDate,
        Pageable pageable
    );

    /** Range read for one doctor narrowed to a single status. */
    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate >= :fromDate
          and a.appointmentDate <= :toDate
          and a.status = :status
        """)
    Page<Appointment> findRangeForDoctorByStatus(
        @Param("doctorId") UUID doctorId,
        @Param("fromDate") LocalDate fromDate,
        @Param("toDate") LocalDate toDate,
        @Param("status") AppointmentStatus status,
        Pageable pageable
    );
}
