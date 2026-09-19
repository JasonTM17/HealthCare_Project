package com.healthcare.careplan.repository;

import com.healthcare.careplan.entity.PatientCarePlan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientCarePlanRepository extends JpaRepository<PatientCarePlan, UUID> {

    Optional<PatientCarePlan> findByIdAndDeletedAtIsNull(UUID id);

    List<PatientCarePlan> findByPatientProfileIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID patientProfileId);

    List<PatientCarePlan> findByDoctorIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID doctorId);

    Optional<PatientCarePlan> findByAppointmentIdAndDeletedAtIsNull(UUID appointmentId);

    @Query("""
        SELECT p FROM PatientCarePlan p
        WHERE p.deletedAt IS NULL
          AND p.patientProfileId IN (
              SELECT pp.id FROM com.healthcare.appointment.entity.PatientProfile pp WHERE pp.user.id = :userId
          )
        ORDER BY p.createdAt DESC
        """)
    List<PatientCarePlan> findAllByPatientUserId(@Param("userId") UUID userId);

    @Query("""
        SELECT p FROM PatientCarePlan p
        WHERE p.deletedAt IS NULL
          AND p.doctorId = :doctorId
        ORDER BY p.createdAt DESC
        """)
    Page<PatientCarePlan> findByDoctorIdPaged(@Param("doctorId") UUID doctorId, Pageable pageable);
}
