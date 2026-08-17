package com.healthcare.clinical.repository;

import com.healthcare.clinical.entity.Prescription;
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
public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    @Query("select p from Prescription p join fetch p.patient join fetch p.doctor left join fetch p.items where p.prescriptionCode = :code")
    Optional<Prescription> findByPrescriptionCodeWithItems(@Param("code") String code);

    Page<Prescription> findByPatientIdOrderByCreatedAtDesc(UUID patientId, Pageable pageable);

    List<Prescription> findByMedicalRecordId(UUID medicalRecordId);

    List<Prescription> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<Prescription> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId);
}
