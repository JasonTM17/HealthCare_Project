package com.healthcare.document.repository;

import com.healthcare.document.entity.DocumentSourceType;
import com.healthcare.document.entity.DocumentStatus;
import com.healthcare.document.entity.PatientDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientDocumentRepository extends JpaRepository<PatientDocument, UUID> {

    Optional<PatientDocument> findByIdempotencyKey(String idempotencyKey);

    List<PatientDocument> findByPatientIdOrderByGeneratedAtDesc(UUID patientId);

    Optional<PatientDocument> findByIdAndPatientId(UUID id, UUID patientId);

    List<PatientDocument> findByPatientIdAndSourceTypeAndSourceRecordIdAndStatusIn(
            UUID patientId,
            DocumentSourceType sourceType,
            UUID sourceRecordId,
            Collection<DocumentStatus> statuses);
}
