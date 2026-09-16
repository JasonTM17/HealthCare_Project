package com.healthcare.clinical.repository;

import com.healthcare.clinical.entity.DiagnosticOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiagnosticOrderRepository extends JpaRepository<DiagnosticOrder, java.util.UUID> {

    List<DiagnosticOrder> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    List<DiagnosticOrder> findByPatientIdAndDoctorIdOrderByCreatedAtDesc(UUID patientId, UUID doctorId);

    List<DiagnosticOrder> findByPatientIdAndDoctorIdAndStatusInOrderByCreatedAtDesc(
        UUID patientId,
        UUID doctorId,
        Collection<String> statuses
    );
}
