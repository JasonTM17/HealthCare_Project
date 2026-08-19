package com.healthcare.clinical.repository;

import com.healthcare.clinical.entity.DiagnosticResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DiagnosticResultRepository extends JpaRepository<DiagnosticResult, UUID> {
    List<DiagnosticResult> findByPatientIdOrderByTestDateDesc(UUID patientId);

    List<DiagnosticResult> findByPatientIdAndDoctorIdOrderByTestDateDesc(UUID patientId, UUID doctorId);

    boolean existsByStoredFileId(UUID storedFileId);
}
