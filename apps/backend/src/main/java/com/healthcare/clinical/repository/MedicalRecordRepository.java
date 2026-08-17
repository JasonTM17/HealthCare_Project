package com.healthcare.clinical.repository;

import com.healthcare.clinical.entity.MedicalRecord;
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
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, UUID> {

    @Query("select m from MedicalRecord m join fetch m.patient join fetch m.doctor left join fetch m.appointment where m.id = :id")
    Optional<MedicalRecord> findByIdWithDetails(@Param("id") UUID id);

    Optional<MedicalRecord> findByAppointmentId(UUID appointmentId);

    Page<MedicalRecord> findByPatientIdOrderByCreatedAtDesc(UUID patientId, Pageable pageable);

    List<MedicalRecord> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    Page<MedicalRecord> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId, Pageable pageable);

    List<MedicalRecord> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId);

    Page<MedicalRecord> findByDoctorIdOrderByCreatedAtDesc(UUID doctorId, Pageable pageable);

    boolean existsByPatientIdAndDoctorId(UUID patientId, UUID doctorId);
}
