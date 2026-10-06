package com.healthcare.document.repository;

import com.healthcare.document.entity.DocumentSourceType;
import com.healthcare.document.entity.DocumentStatus;
import com.healthcare.document.entity.PatientDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    Optional<PatientDocument> findFirstByPatientIdAndSourceTypeAndSourceRecordIdAndStatusInOrderByGeneratedAtDesc(
            UUID patientId, DocumentSourceType sourceType, UUID sourceRecordId,
            Collection<DocumentStatus> statuses);

    List<PatientDocument> findByPatientIdAndSourceTypeAndSourceRecordIdAndStatusIn(
            UUID patientId,
            DocumentSourceType sourceType,
            UUID sourceRecordId,
            Collection<DocumentStatus> statuses);

    /**
     * Newest FAILED row for one source, deliberately ignoring the version and
     * template that produced it. Orphaned FAILED rows predate version alignment
     * (ADR-005), so a retry must reuse the existing row instead of inserting a
     * duplicate that leaves the old row stuck on the patient's panel.
     *
     * <p>{@code findFirst} keeps the result deterministic (newest first) when the
     * historical bug already accumulated more than one FAILED row for a source.
     */
    Optional<PatientDocument> findFirstByPatientIdAndSourceTypeAndSourceRecordIdAndStatusOrderByGeneratedAtDesc(
            UUID patientId,
            DocumentSourceType sourceType,
            UUID sourceRecordId,
            DocumentStatus status);

    @Query(value = "SELECT pg_advisory_xact_lock(hashtextextended(CAST(:lockKey AS text), 0))", nativeQuery = true)
    void acquireGenerationLock(@Param("lockKey") String lockKey);
}
