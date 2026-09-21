package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.Appointment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
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

    /**
     * Serializes confirm/cancel transitions for one booking. A plain read here
     * allows two state transitions to observe the same PENDING row and then
     * overwrite each other.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a join fetch a.patient join fetch a.doctor left join fetch a.specialty left join fetch a.branch left join fetch a.medicalPackage where a.bookingCode = :bookingCode")
    Optional<Appointment> findByBookingCodeWithDetailsForUpdate(@Param("bookingCode") String bookingCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a join fetch a.patient join fetch a.doctor left join fetch a.specialty left join fetch a.branch left join fetch a.medicalPackage where a.id = :id")
    Optional<Appointment> findByIdWithDetailsForUpdate(@Param("id") UUID id);

    /**
     * Portal reads load every to-one field used by the role-specific response
     * in one query. The patient/doctor id is resolved by the service from the
     * authenticated principal; it is never supplied by the caller.
     */
    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("select a from Appointment a where a.patient.id = :patientId")
    Page<Appointment> findPortalAppointmentsForPatient(
        @Param("patientId") UUID patientId,
        Pageable pageable
    );

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("""
        select a from Appointment a
        where (:patientId is not null and a.patient.id = :patientId)
           or exists (
               select c.id from AppointmentAccountClaim c
               where c.appointment.id = a.id and c.user.id = :userId
           )
    """)
    Page<Appointment> findPortalAppointmentsForPatientOrClaim(
        @Param("patientId") UUID patientId,
        @Param("userId") UUID userId,
        Pageable pageable
    );

    @Query("""
        select a from Appointment a join fetch a.patient
        where a.status = 'CONFIRMED'
          and lower(a.patient.email) = lower(:email)
          and not exists (select c.id from AppointmentAccountClaim c where c.appointment.id = a.id)
    """)
    List<Appointment> findConfirmedUnclaimedByPatientEmail(@Param("email") String email);

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("select a from Appointment a where a.doctor.id = :doctorId and a.appointmentDate = :appointmentDate")
    Page<Appointment> findPortalAppointmentsForDoctor(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        Pageable pageable
    );

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("select a from Appointment a where a.doctor.id = :doctorId and a.appointmentDate = :appointmentDate and a.status = :status")
    Page<Appointment> findPortalAppointmentsForDoctorByStatus(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("status") com.healthcare.appointment.entity.AppointmentStatus status,
        Pageable pageable
    );

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    @Query("select a from Appointment a")
    Page<Appointment> findAllForAdmin(Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    Page<Appointment> findByAppointmentDate(LocalDate appointmentDate, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    Page<Appointment> findByStatus(com.healthcare.appointment.entity.AppointmentStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "specialty", "branch", "medicalPackage"})
    Page<Appointment> findByAppointmentDateAndStatus(
        LocalDate appointmentDate,
        com.healthcare.appointment.entity.AppointmentStatus status,
        Pageable pageable
    );

    Page<Appointment> findByPatientIdOrderByAppointmentDateDescStartTimeDesc(UUID patientId, Pageable pageable);

    boolean existsByPatientIdAndDoctorIdAndStatusInAndAppointmentDate(
        UUID patientId,
        UUID doctorId,
        java.util.Collection<com.healthcare.appointment.entity.AppointmentStatus> statuses,
        java.time.LocalDate appointmentDate);

    boolean existsByPatientIdAndDoctorIdAndStatusIn(
        UUID patientId,
        UUID doctorId,
        java.util.Collection<com.healthcare.appointment.entity.AppointmentStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and ((:branchId is null and a.branch is null) or a.branch.id = :branchId)
          and a.appointmentDate = :appointmentDate
          and a.startTime < :endTime
          and a.endTime > :startTime
          and (
            a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            or (a.status = 'PENDING_CONFIRMATION' and a.holdExpiresAt > :now)
          )
    """)
    List<Appointment> findActiveConflictsForUpdate(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime,
        @Param("now") OffsetDateTime now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and ((:branchId is null and a.branch is null) or a.branch.id = :branchId)
          and a.appointmentDate = :appointmentDate
          and a.startTime < :endTime
          and a.endTime > :startTime
          and a.status = 'PENDING_CONFIRMATION'
          and (a.holdExpiresAt is null or a.holdExpiresAt <= :now)
    """)
    List<Appointment> findExpiredPendingConflictsForUpdate(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime,
        @Param("now") OffsetDateTime now
    );

    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and ((:branchId is null and a.branch is null) or a.branch.id = :branchId)
          and a.appointmentDate = :appointmentDate
          and (
            a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            or (a.status = 'PENDING_CONFIRMATION' and a.holdExpiresAt > :now)
          )
    """)
    List<Appointment> findAllOccupiedSlots(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("now") OffsetDateTime now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Appointment a
        where a.doctor.id = :doctorId
          and a.appointmentDate = :appointmentDate
          and a.startTime < :endTime
          and a.endTime > :startTime
          and (:excludeAppointmentId is null or a.id <> :excludeAppointmentId)
          and (
            a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            or (a.status = 'PENDING_CONFIRMATION' and a.holdExpiresAt > :now)
          )
    """)
    List<Appointment> findDoctorOverlapsForUpdate(
        @Param("doctorId") UUID doctorId,
        @Param("appointmentDate") LocalDate appointmentDate,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime,
        @Param("now") OffsetDateTime now,
        @Param("excludeAppointmentId") UUID excludeAppointmentId
    );

    /**
     * Row-locked, bounded batch of abandoned holds. {@code SKIP LOCKED} keeps a
     * scheduled sweep from blocking (or waiting on) an in-flight booking.
     */
    @Query(value = """
        SELECT * FROM appointments
        WHERE status = 'PENDING_CONFIRMATION'
          AND hold_expires_at IS NOT NULL
          AND hold_expires_at <= :now
        ORDER BY hold_expires_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    """, nativeQuery = true)
    List<Appointment> lockExpiredPendingHolds(@Param("now") OffsetDateTime now);

    @Query("""
        select a from Appointment a
        where a.holdIdempotencyKey = :idempotencyKey
    """)
    Optional<Appointment> findByHoldIdempotencyKey(@Param("idempotencyKey") String idempotencyKey);

    @Query("""
        select count(a) from Appointment a
        where a.patient.id = :patientId
          and a.status = 'PENDING_CONFIRMATION'
          and a.holdExpiresAt is not null
          and a.holdExpiresAt > :now
    """)
    long countLiveHoldsForPatient(
        @Param("patientId") UUID patientId,
        @Param("now") OffsetDateTime now
    );

    /**
     * Live bookings that a schedule change would strand. The caller supplies an
     * already clamped, non-null date range so an open-ended schedule cannot
     * turn into an unbounded scan.
     *
     * <p>{@code PENDING_CONFIRMATION} counts regardless of its hold expiry: the
     * guard is deliberately conservative, and the scheduled hold sweeper clears
     * abandoned rows within a minute.
     */
    @Query(value = """
        SELECT count(*) FROM appointments a
        WHERE a.doctor_id = :doctorId
          AND a.branch_id = :branchId
          AND a.appointment_date >= :fromDate
          AND a.appointment_date <= :toDate
          AND CAST(EXTRACT(ISODOW FROM a.appointment_date) AS integer) = :isoDayOfWeek
          AND a.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'PENDING_CONFIRMATION')
    """, nativeQuery = true)
    long countActiveBookingsForWeekday(
        @Param("doctorId") UUID doctorId,
        @Param("branchId") UUID branchId,
        @Param("fromDate") LocalDate fromDate,
        @Param("toDate") LocalDate toDate,
        @Param("isoDayOfWeek") int isoDayOfWeek
    );

    @Query(value = """
        SELECT * FROM appointments
        WHERE status = 'CONFIRMED'
          AND reminder_sent_at IS NULL
          AND appointment_time >= :windowStart
          AND appointment_time < :windowEnd
        ORDER BY appointment_time
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    """, nativeQuery = true)
    List<Appointment> lockDueReminders(
        @Param("windowStart") OffsetDateTime windowStart,
        @Param("windowEnd") OffsetDateTime windowEnd
    );
}
