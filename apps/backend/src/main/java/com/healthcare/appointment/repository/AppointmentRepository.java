package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.Appointment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    /**
     * PostgreSQL transaction-scoped advisory lock for the logical appointment slot.
     * This closes the empty-result race that row-level pessimistic locks cannot cover.
     */
    @Query(value = "SELECT pg_advisory_xact_lock(hashtext(CAST(:lockKey AS text)))", nativeQuery = true)
    void acquireSlotLock(@Param("lockKey") String lockKey);

    Optional<Appointment> findByBookingCode(String bookingCode);

    @Query("select a from Appointment a join fetch a.patient join fetch a.doctor left join fetch a.specialty left join fetch a.branch left join fetch a.medicalPackage where a.bookingCode = :bookingCode")
    Optional<Appointment> findByBookingCodeWithDetails(@Param("bookingCode") String bookingCode);

    Page<Appointment> findByPatientIdOrderByAppointmentDateDescStartTimeDesc(UUID patientId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate = :appointmentDate
          and a.startTime = :startTime
          and (
            a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            or (a.status = 'PENDING_CONFIRMATION' and a.holdExpiresAt > :now)
          )
    """)
    List<Appointment> findActiveConflictsForUpdate(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("startTime") LocalTime startTime,
        @Param("now") OffsetDateTime now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate = :appointmentDate
          and a.startTime = :startTime
          and a.status = 'PENDING_CONFIRMATION'
          and (a.holdExpiresAt is null or a.holdExpiresAt <= :now)
    """)
    List<Appointment> findExpiredPendingConflictsForUpdate(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("startTime") LocalTime startTime,
        @Param("now") OffsetDateTime now
    );

    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate = :appointmentDate
          and (
            a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            or (a.status = 'PENDING_CONFIRMATION' and a.holdExpiresAt > :now)
          )
    """)
    List<Appointment> findAllOccupiedSlots(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("now") OffsetDateTime now
    );
}
