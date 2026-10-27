package com.healthcare.document.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.entity.Prescription;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.document.dto.DocumentCapabilitiesResponse;
import com.healthcare.document.dto.DocumentResponse;
import com.healthcare.document.dto.GenerateDocumentRequest;
import com.healthcare.document.entity.DocumentSourceType;
import com.healthcare.document.entity.DocumentStatus;
import com.healthcare.document.entity.PatientDocument;
import com.healthcare.document.repository.PatientDocumentRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import jakarta.persistence.EntityManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Synthetic clinical document generation, listing and authorized download
 * (ADR-005 / D-03). Approved classes: VISIT_SUMMARY, PRESCRIPTION and
 * APPOINTMENT_REMINDER; every artifact is a demo export. Ownership model: the
 * owning patient, the doctor who issued the source record, or an administrator.
 */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    public static final String TARGET_DOCUMENT = "DOCUMENT";
    public static final String ACTION_GENERATE = "GENERATE";
    public static final String ACTION_REVOKE = "REVOKE";
    public static final String DOCUMENT_CONTENT_TYPE = "application/pdf";
    static final String OBJECT_KEY_PREFIX = "documents/";
    // Match the private bucket/upload limit; never buffer an unbounded object.
    private static final long MAX_DOWNLOAD_BYTES = 10L * 1024 * 1024;

    private final PatientDocumentRepository documentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final DocumentObjectStore objectStore;
    private final DocumentObjectCleanupService cleanupService;
    private final SyntheticPdfRenderer renderer;
    private final DocumentSnapshotCodec snapshotCodec;
    private final ClinicalAccessAuditService auditService;
    private final EntityManager entityManager;

    public DocumentService(
            PatientDocumentRepository documentRepository,
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            AppointmentRepository appointmentRepository,
            DocumentObjectStore objectStore,
            DocumentObjectCleanupService cleanupService,
            SyntheticPdfRenderer renderer,
            DocumentSnapshotCodec snapshotCodec,
            ClinicalAccessAuditService auditService,
            EntityManager entityManager) {
        this.documentRepository = documentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.objectStore = objectStore;
        this.cleanupService = cleanupService;
        this.renderer = renderer;
        this.snapshotCodec = snapshotCodec;
        this.auditService = auditService;
        this.entityManager = entityManager;
    }

    public record DocumentDownload(PatientDocument document, InputStream stream) {
    }

    @Transactional(readOnly = true)
    public DocumentCapabilitiesResponse capabilities(UUID patientId, UserDetails principal) {
        authorizePatientScope(patientId, principal);
        return new DocumentCapabilitiesResponse(objectStore.isConfigured());
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public DocumentResponse generateDocument(
            UUID patientId,
            GenerateDocumentRequest request,
            UserDetails principal) {
        authorizePatientScope(patientId, principal);
        // Bound the advisory-lock wait: a waiter holds a main-pool connection
        // for the holder's entire render + object upload, so an unbounded wait
        // can exhaust the pool. 5s then a clean 409 beats a pool stall.
        entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
        try {
            documentRepository.acquireGenerationLock(
                    "DOCUMENT_GENERATION:" + request.sourceType().name() + ":" + request.sourceRecordId());
            // lock_timeout stays armed for the rest of the transaction, so a
            // later contended row lock surfaces the same way as a contended
            // advisory lock — map both to the retryable 409, not a 500.
            return generateDocumentLocked(patientId, request, principal);
        } catch (PessimisticLockingFailureException | org.springframework.dao.OptimisticLockingFailureException
                | jakarta.persistence.LockTimeoutException | jakarta.persistence.PessimisticLockException
                | jakarta.persistence.OptimisticLockException exception) {
            recordAuditSafely(principal, patientId,
                request.sourceRecordId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_DENY, null);
            throw new BusinessException(409, "Tài liệu đang được tạo, vui lòng thử lại sau giây lát");
        }
    }

    /** Explicit recovery creates a new export and never adopts/supersedes an old row. */
    @Transactional(noRollbackFor = BusinessException.class)
    public DocumentResponse regenerateDocument(UUID patientId, UUID documentId, UserDetails principal) {
        authorizePatientScope(patientId, principal);
        PatientDocument original = documentRepository.findByIdAndPatientId(documentId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
        UUID originalSourceId = original.getSourceRecordId();
        DocumentSourceType originalSourceType = original.getSourceType();
        entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
        try {
            documentRepository.acquireGenerationLock("DOCUMENT_GENERATION:"
                    + original.getSourceType().name() + ":" + original.getSourceRecordId());
            UUID actorId = resolveUserId(principal);
            lockRecoveryInputs(original, actorId);
            // Rows were locked through SQL. Discard values loaded before waiting
            // for those locks, including lazy joined display fields/role mappings.
            entityManager.clear();
            User actor = resolveUser(principal);
            validateRecoveryActor(actor, principal);
            UserDetails currentPrincipal = HealthcareUserPrincipal.from(actor);
            authorizePatientScope(patientId, currentPrincipal);
            original = documentRepository.findByIdAndPatientId(documentId, patientId)
                    .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
            if (!originalSourceId.equals(original.getSourceRecordId())
                    || originalSourceType != original.getSourceType()) {
                throw new BusinessException(409, "Nguồn tài liệu vừa thay đổi, vui lòng tải lại danh sách");
            }
            if (original.getStatus() != DocumentStatus.FAILED
                    && original.getStatus() != DocumentStatus.AVAILABLE) {
                throw new BusinessException(409, "Tài liệu đã thu hồi, thay thế hoặc đang xử lý không thể tạo bản khôi phục");
            }
            if (!objectStore.isConfigured()) {
                throw new BusinessException(503, "SERVICE_UNAVAILABLE", "Kho lưu trữ chưa sẵn sàng");
            }
            DocumentSnapshot snapshot = snapshotForRecovery(patientId, original, currentPrincipal);
            String snapshotHash = snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(snapshot));
            String recoveryKey = "RECOVERY:" + original.getId() + ":" + snapshotHash;
            PatientDocument replacement = documentRepository.findByIdempotencyKey(recoveryKey).orElse(null);
            if (replacement != null && replacement.getStatus() != DocumentStatus.FAILED
                    && replacement.getStatus() != DocumentStatus.PENDING) {
                if (replacement.getStatus() != DocumentStatus.AVAILABLE) {
                    throw new BusinessException(409, "Bản PDF mới đã thu hồi hoặc thay thế");
                }
                recordAuditAfterCommit(principal, patientId, replacement.getId().toString(),
                        ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW);
                return toResponse(replacement);
            }
            byte[] pdf = render(snapshot, snapshotHash);
            if (replacement == null) {
                replacement = new PatientDocument();
                replacement.setPatient(patientProfileRepository.findById(patientId).orElseThrow());
                replacement.setSourceType(snapshot.sourceType());
                replacement.setSourceRecordId(snapshot.sourceRecordId());
                replacement.setSourceVersion(snapshot.sourceVersion());
                replacement.setTemplateVersion(snapshot.templateVersion());
                replacement.setObjectKey(OBJECT_KEY_PREFIX + patientId + "/" + UUID.randomUUID() + ".pdf");
                replacement.setIdempotencyKey(recoveryKey);
                replacement.setRegeneratedFromDocumentId(original.getId());
                replacement.setSourceSnapshotSha256(snapshotHash);
                replacement.setRecoveryReason("LOST_FILE_COPY");
            }
            replacement.setStatus(DocumentStatus.PENDING);
            replacement.setGeneratedBy(actor);
            replacement.setGeneratedAt(OffsetDateTime.now());
            replacement.setSha256(null);
            replacement.setByteSize(null);
            documentRepository.saveAndFlush(replacement);
            // Every source/actor/original row lock remains held across rendering,
            // object upload and publication/commit. Source facts are never edited.
            return storeAndFinalize(replacement, patientId, principal, pdf, false);
        } catch (PessimisticLockingFailureException | org.springframework.dao.OptimisticLockingFailureException
                | jakarta.persistence.LockTimeoutException | jakarta.persistence.PessimisticLockException
                | jakarta.persistence.OptimisticLockException exception) {
            // Deadlock victims surface as OptimisticLockException too: the
            // recovery can simply be retried once the winner commits.
            throw new BusinessException(409, "Tài liệu đang được cập nhật, vui lòng thử lại sau giây lát");
        }
    }

    private DocumentSnapshot snapshotForRecovery(UUID patientId, PatientDocument original, UserDetails principal) {
        return switch (original.getSourceType()) {
            case VISIT_SUMMARY -> snapshotFromMedicalRecord(patientId, original.getSourceRecordId(), principal);
            case PRESCRIPTION -> snapshotFromPrescription(patientId, original.getSourceRecordId(), principal, true);
            case APPOINTMENT_REMINDER -> snapshotFromAppointment(patientId, original.getSourceRecordId(), principal);
        };
    }

    private void validateRecoveryActor(User actor, UserDetails principal) {
        Set<String> currentRoles = actor.getRoles().stream().map(role -> "ROLE_" + role.getCode())
                .collect(Collectors.toSet());
        Set<String> sessionRoles = principal.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority).collect(Collectors.toSet());
        if (!"ACTIVE".equals(actor.getStatus()) || !actor.isEmailVerified()
                || !currentRoles.equals(sessionRoles)
                || (principal instanceof HealthcareUserPrincipal session
                    && actor.getSecurityVersion() != session.getSecurityVersion())) {
            throw new AccessDeniedException("Authenticated authority changed; sign in again");
        }
    }

    private void lockRecoveryInputs(PatientDocument original, UUID actorId) {
        lockRows("SELECT id FROM users WHERE id = :id FOR UPDATE", actorId);
        lockRows("SELECT user_id FROM user_roles WHERE user_id = :id ORDER BY role_id FOR UPDATE", actorId);
        lockRows("SELECT id FROM roles WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = :id) ORDER BY id FOR SHARE", actorId);
        lockRows("SELECT id FROM doctors WHERE user_id = :id ORDER BY id FOR UPDATE", actorId);
        lockRows("SELECT id FROM patient_documents WHERE id = :id FOR UPDATE", original.getId());
        String table = switch (original.getSourceType()) {
            case VISIT_SUMMARY -> "medical_records";
            case PRESCRIPTION -> "prescriptions";
            case APPOINTMENT_REMINDER -> "appointments";
        };
        UUID sourceId = original.getSourceRecordId();
        // FOR UPDATE on the parent also blocks FK key-share acquisition for
        // inserted prescription items, preventing collection phantoms.
        lockRows("SELECT id FROM " + table + " WHERE id = :id FOR UPDATE", sourceId);
        lockRows("SELECT id FROM patient_profiles WHERE id = (SELECT patient_id FROM " + table + " WHERE id = :id) FOR UPDATE", sourceId);
        lockRows("SELECT id FROM doctors WHERE id = (SELECT doctor_id FROM " + table + " WHERE id = :id) FOR UPDATE", sourceId);
        if (original.getSourceType() == DocumentSourceType.VISIT_SUMMARY) {
            lockRows("SELECT id FROM appointments WHERE id = (SELECT appointment_id FROM medical_records WHERE id = :id) FOR UPDATE", sourceId);
        } else if (original.getSourceType() == DocumentSourceType.PRESCRIPTION) {
            lockRows("SELECT id FROM prescription_items WHERE prescription_id = :id ORDER BY id FOR UPDATE", sourceId);
        } else {
            lockRows("SELECT id FROM branches WHERE id = (SELECT branch_id FROM appointments WHERE id = :id) FOR UPDATE", sourceId);
            lockRows("SELECT id FROM specialties WHERE id = (SELECT specialty_id FROM appointments WHERE id = :id) FOR UPDATE", sourceId);
        }
    }

    private void lockRows(String sql, UUID id) {
        entityManager.createNativeQuery(sql).setParameter("id", id).getResultList();
    }

    private DocumentResponse generateDocumentLocked(
            UUID patientId,
            GenerateDocumentRequest request,
            UserDetails principal) {
        PatientProfile patient = patientProfileRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));

        DocumentSnapshot snapshot = switch (request.sourceType()) {
            case VISIT_SUMMARY -> snapshotFromMedicalRecord(patientId, request.sourceRecordId(), principal);
            case PRESCRIPTION -> snapshotFromPrescription(patientId, request.sourceRecordId(), principal);
            case APPOINTMENT_REMINDER -> snapshotFromAppointment(patientId, request.sourceRecordId(), principal);
        };

        String idempotencyKey = buildIdempotencyKey(snapshot);
        PatientDocument existing = documentRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        // FAILED rows retry in place below; an orphaned committed PENDING row
        // (unreachable through the current flush+finalize transaction but
        // possible via legacy/manual data) takes the same path — treating it
        // as idempotent would permanently brick this source.
        if (existing != null && existing.getStatus() != DocumentStatus.FAILED
                && existing.getStatus() != DocumentStatus.PENDING) {
            // Idempotent regeneration: same key returns the same row and never
            // writes a second object.
            recordAuditSafely(principal, patientId,
                existing.getId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW, null);
            return toResponse(existing);
        }
        // Orphaned FAILED rows predate version alignment (ADR-005): a row stored
        // under an older template/source version never matches today's key, so
        // every retry would insert another row and leave the old FAILED row stuck
        // on the patient's panel forever. Reuse the newest FAILED row for this
        // source instead, and adopt the current identity so the next call becomes
        // idempotent again. patientId/sourceType/sourceRecordId are all required:
        // source_record_id is a bare UUID shared by three source tables, so
        // dropping any of them could hand one patient's row to another source.
        boolean adoptedFailedOrphan = false;
        if (existing == null) {
            // A failed recovery child owns a different accepted snapshot/key.
            // Leave it untouched for explicit recovery retry; only legacy NULL
            // lineage rows belong to ordinary orphan adoption.
            existing = documentRepository
                .findFirstByPatientIdAndSourceTypeAndSourceRecordIdAndStatusAndRegeneratedFromDocumentIdIsNullOrderByGeneratedAtDesc(
                    patientId, snapshot.sourceType(), snapshot.sourceRecordId(), DocumentStatus.FAILED)
                .orElse(null);
            adoptedFailedOrphan = existing != null;
        }

        User generatedBy = resolveUser(principal);
        String snapshotHash = snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(snapshot));
        byte[] pdfBytes = render(snapshot, snapshotHash);
        if (existing != null) {
            // Retry a previously failed object write in place. The idempotency
            // key still points at one row, but a transient MinIO outage does
            // not permanently brick this source/version/template.
            if (adoptedFailedOrphan) {
                existing.setSourceVersion(snapshot.sourceVersion());
                existing.setTemplateVersion(snapshot.templateVersion());
                existing.setIdempotencyKey(idempotencyKey);
            }
            existing.setStatus(DocumentStatus.PENDING);
            existing.setGeneratedBy(generatedBy);
            existing.setSha256(null);
            existing.setByteSize(null);
            PatientDocument retry;
            try {
                retry = documentRepository.saveAndFlush(existing);
            } catch (DataIntegrityViolationException exception) {
                // The constraint violation already aborted this transaction, so
                // the winner's row cannot be read back inside it. Propagate to
                // the global 409 handler; a client retry resolves the winner
                // idempotently (same shape as the advisory-lock path above).
                recordAuditSafely(principal, patientId, request.sourceRecordId().toString(),
                    ACTION_GENERATE, ClinicalAccessAuditService.DECISION_DENY, exception);
                throw exception;
            }
            return storeAndFinalize(retry, patientId, principal, pdfBytes);
        }

        PatientDocument document = new PatientDocument();
        document.setPatient(patient);
        document.setSourceRecordId(snapshot.sourceRecordId());
        document.setSourceType(snapshot.sourceType());
        document.setSourceVersion(snapshot.sourceVersion());
        document.setTemplateVersion(snapshot.templateVersion());
        document.setStatus(DocumentStatus.PENDING);
        document.setObjectKey(OBJECT_KEY_PREFIX + patientId + "/" + UUID.randomUUID() + ".pdf");
        document.setGeneratedBy(generatedBy);
        document.setIdempotencyKey(idempotencyKey);
        try {
            documentRepository.saveAndFlush(document);
        } catch (DataIntegrityViolationException exception) {
            // A concurrent request claimed the same idempotency key first, but
            // the constraint violation already aborted this transaction — the
            // winner's row cannot be read back inside it. Propagate to the
            // global 409 handler; a client retry resolves the winner
            // idempotently.
            recordAuditSafely(principal, patientId, request.sourceRecordId().toString(),
                ACTION_GENERATE, ClinicalAccessAuditService.DECISION_DENY, exception);
            throw exception;
        }

        return storeAndFinalize(document, patientId, principal, pdfBytes);
    }

    private DocumentResponse storeAndFinalize(
            PatientDocument document,
            UUID patientId,
            UserDetails principal,
            byte[] pdfBytes) {
        return storeAndFinalize(document, patientId, principal, pdfBytes, true);
    }

    private DocumentResponse storeAndFinalize(PatientDocument document, UUID patientId,
            UserDetails principal, byte[] pdfBytes, boolean supersedeOriginals) {
        boolean objectUploaded = false;
        try {
            cleanupService.trackCandidate(document.getObjectKey());
            objectStore.put(document.getObjectKey(), pdfBytes, DOCUMENT_CONTENT_TYPE);
            objectUploaded = true;
        } catch (Exception exception) {
            if (objectUploaded) {
                cleanupStoredObject(document.getObjectKey(), exception);
            }
            // ADR-005 requires failed generation attempts to remain visible and
            // recoverable instead of disappearing as a rollback-only side effect.
            document.setStatus(DocumentStatus.FAILED);
            documentRepository.saveAndFlush(document);
            recordAuditSafely(principal, patientId, document.getId().toString(),
                ACTION_GENERATE, ClinicalAccessAuditService.DECISION_DENY, exception);
            throw new BusinessException(503, "Không thể lưu tài liệu vào kho đối tượng");
        }

        PatientDocument saved;
        try {
            document.setStatus(DocumentStatus.AVAILABLE);
            document.setSha256(snapshotCodec.sha256Hex(pdfBytes));
            document.setByteSize((long) pdfBytes.length);
            saved = documentRepository.saveAndFlush(document);
            if (supersedeOriginals) {
                supersedePreviousAvailableVersions(saved);
            }
            resolveCleanupAfterCommit(saved.getObjectKey());
        } catch (RuntimeException exception) {
            cleanupStoredObject(document.getObjectKey(), exception);
            throw exception;
        }
        // The ALLOW row is evidence for a committed generation — recording it
        // inside the transaction would let a failed commit leave an audit row
        // for a document that does not exist.
        recordAuditAfterCommit(principal, patientId, saved.getId().toString(),
            ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW);
        return toResponse(saved);
    }

    private void supersedePreviousAvailableVersions(PatientDocument saved) {
        List<PatientDocument> candidates = documentRepository
                .findByPatientIdAndSourceTypeAndSourceRecordIdAndStatusIn(
                        saved.getPatient().getId(),
                        saved.getSourceType(),
                        saved.getSourceRecordId(),
                        List.of(DocumentStatus.AVAILABLE));
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        OffsetDateTime supersededAt = OffsetDateTime.now();
        List<PatientDocument> superseded = candidates.stream()
                .filter(document -> document.getId() != null && !document.getId().equals(saved.getId()))
                .filter(document -> !document.getIdempotencyKey().equals(saved.getIdempotencyKey()))
                .peek(document -> {
                    document.setStatus(DocumentStatus.SUPERSEDED);
                    document.setRevokedAt(supersededAt);
                })
                .toList();
        if (!superseded.isEmpty()) {
            documentRepository.saveAll(superseded);
        }
    }

    private void recordAuditAfterCommit(
            UserDetails principal, UUID patientId, String targetId, String action, String decision) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            recordAuditSafely(principal, patientId, targetId, action, decision, null);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                recordAuditSafely(principal, patientId, targetId, action, decision, null);
            }
        });
    }

    /**
     * Audit writes run on the independent side pool and must never mask the
     * primary outcome: a side-pool outage should not turn a mapped 503/409
     * into an unhandled 500. Every primary-path allow/deny site must use this
     * fail-soft form — an audit outage degrades evidence, never denies service.
     */
    private void recordAuditSafely(
            UserDetails principal,
            UUID patientId,
            String targetId,
            String action,
            String decision,
            Throwable carrier) {
        try {
            auditService.record(principal, patientId, TARGET_DOCUMENT, targetId, action, decision);
        } catch (RuntimeException auditFailure) {
            if (carrier != null) {
                carrier.addSuppressed(auditFailure);
            } else {
                log.warn("Clinical audit record failed for patient {} target {}: {}",
                        patientId, targetId, auditFailure.getMessage());
            }
        }
    }

    private void resolveCleanupAfterCommit(String objectKey) {
        // The marker resolve must never mask a committed outcome: a side-pool
        // failure inside afterCommit propagates through commit() and would
        // surface a successful write as a 500. The worker's reconcile pass
        // self-heals an unresolved PENDING marker.
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            resolveCleanupQuietly(objectKey);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                resolveCleanupQuietly(objectKey);
            }
        });
    }

    private void resolveCleanupQuietly(String objectKey) {
        try {
            cleanupService.resolveCandidate(objectKey);
        } catch (RuntimeException markerFailure) {
            log.warn("Cleanup marker resolve failed for object {}: {}", objectKey, markerFailure.getMessage());
        }
    }

    private void cleanupStoredObject(String objectKey, Exception originalFailure) {
        boolean deleted = false;
        try {
            objectStore.delete(objectKey);
            deleted = true;
        } catch (Exception cleanupFailure) {
            originalFailure.addSuppressed(cleanupFailure);
        }
        if (deleted) {
            try {
                cleanupService.resolveCandidate(objectKey);
            } catch (RuntimeException cleanupMarkerFailure) {
                originalFailure.addSuppressed(cleanupMarkerFailure);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocuments(UUID patientId, UserDetails principal) {
        try {
            authorizePatientScope(patientId, principal);
            List<PatientDocument> documents = documentRepository
                    .findByPatientIdOrderByGeneratedAtDesc(patientId);
            if (hasRole(principal, "DOCTOR")) {
                // Doctors see only documents synthesized from records they issued.
                Map<DocumentSourceType, Set<UUID>> issuedSourceIds =
                        issuedSourceIds(patientId, requireLinkedDoctor(principal));
                documents = documents.stream()
                        .filter(document -> issuedSourceIds
                                .getOrDefault(document.getSourceType(), Set.of())
                                .contains(document.getSourceRecordId()))
                        .toList();
            }
            recordAuditSafely(principal, patientId, patientId.toString(),
                ClinicalAccessAuditService.ACTION_READ, ClinicalAccessAuditService.DECISION_ALLOW, null);
            Set<UUID> reminderSourceIds = documents.stream()
                    .filter(document -> document.getSourceType() == DocumentSourceType.APPOINTMENT_REMINDER)
                    .map(PatientDocument::getSourceRecordId)
                    .collect(Collectors.toSet());
            Map<UUID, Appointment> reminderSources = reminderSourceIds.isEmpty()
                    ? Map.of()
                    : appointmentRepository.findReminderSourcesWithDetails(patientId, reminderSourceIds)
                            .stream()
                            .collect(Collectors.toMap(Appointment::getId, appointment -> appointment));
            return documents.stream()
                    .map(document -> toResponse(document,
                            reminderSources.get(document.getSourceRecordId())))
                    .toList();
        } catch (AccessDeniedException exception) {
            recordAuditSafely(principal, patientId, patientId.toString(),
                ClinicalAccessAuditService.ACTION_READ, ClinicalAccessAuditService.DECISION_DENY, null);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public DocumentDownload downloadDocument(UUID patientId, UUID documentId, UserDetails principal) {
        try {
            authorizePatientScope(patientId, principal);
        } catch (AccessDeniedException exception) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw exception;
        }
        PatientDocument document = documentRepository.findByIdAndPatientId(documentId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + documentId));
        try {
            authorizeDocumentRead(document, principal);
        } catch (AccessDeniedException exception) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw exception;
        }
        if (document.getStatus() == DocumentStatus.REVOKED
                || document.getStatus() == DocumentStatus.SUPERSEDED) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw new AccessDeniedException("Tài liệu đã bị thu hồi hoặc thay thế và không thể tải xuống");
        }
        if (document.getStatus() != DocumentStatus.AVAILABLE) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw new BusinessException(409, "Tài liệu chưa sẵn sàng để tải xuống");
        }
        validateReminderSource(document, patientId, principal, false);
        if (!objectStore.isConfigured()) {
            throw new BusinessException(503, "Kho đối tượng chưa được cấu hình");
        }
        // Revoke can commit between the AVAILABLE check above and the object
        // fetch; refresh re-reads the row under READ_COMMITTED (the
        // persistence-context cache would otherwise return stale state).
        try {
            entityManager.refresh(document);
        } catch (jakarta.persistence.EntityNotFoundException exception) {
            document.setStatus(DocumentStatus.REVOKED);
        }
        if (document.getStatus() != DocumentStatus.AVAILABLE) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw new AccessDeniedException("Tài liệu đã bị thu hồi hoặc thay thế và không thể tải xuống");
        }
        try {
            int expectedSize = validatedDownloadSize(document);
            byte[] bytes;
            try (InputStream stream = objectStore.get(document.getObjectKey())) {
                // Re-validate once more after the fetch: a revoke that
                // committed during objectStore.get must not hand out a live
                // stream.
                try {
                    entityManager.refresh(document);
                } catch (jakarta.persistence.EntityNotFoundException exception) {
                    document.setStatus(DocumentStatus.REVOKED);
                }
                if (document.getStatus() != DocumentStatus.AVAILABLE) {
                    recordAuditSafely(principal, patientId, documentId.toString(),
                        ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
                    throw new AccessDeniedException("Tài liệu đã bị thu hồi hoặc thay thế và không thể tải xuống");
                }
                // One extra byte detects trailing data without consuming an
                // arbitrarily large object. Nothing is sent until verified.
                bytes = stream.readNBytes(expectedSize + 1);
            }
            // Reading/closing may take time: refresh at the actual handoff
            // boundary, preserving revocation and current ownership rules.
            try {
                try {
                    entityManager.refresh(document);
                } catch (jakarta.persistence.EntityNotFoundException exception) {
                    document.setStatus(DocumentStatus.REVOKED);
                }
                if (document.getStatus() != DocumentStatus.AVAILABLE
                        || !patientId.equals(document.getPatient().getId())) {
                    throw new AccessDeniedException("Tài liệu đã bị thu hồi hoặc thay thế và không thể tải xuống");
                }
                authorizePatientScope(patientId, principal);
                authorizeDocumentRead(document, principal);
            } catch (AccessDeniedException exception) {
                recordAuditSafely(principal, patientId, documentId.toString(),
                    ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
                throw exception;
            }
            validateReminderSource(document, patientId, principal, true);
            if (validatedDownloadSize(document) != bytes.length
                    || !snapshotCodec.sha256Hex(bytes).equals(document.getSha256())) {
                throw new DocumentContentUnavailableException("Stored document integrity mismatch");
            }
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_ALLOW, null);
            return new DocumentDownload(document, new ByteArrayInputStream(bytes));
        } catch (AccessDeniedException | BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY,
                exception);
            throw new BusinessException(503,
                    exception instanceof DocumentContentUnavailableException
                            ? "DOCUMENT_CONTENT_UNAVAILABLE" : "SERVICE_UNAVAILABLE",
                    exception instanceof DocumentContentUnavailableException
                            ? "Tệp tài liệu bị thiếu hoặc không còn khớp dữ liệu lưu trữ"
                            : "Dịch vụ lưu trữ đang tạm gián đoạn, vui lòng thử lại sau");
        }
    }

    private void validateReminderSource(PatientDocument document, UUID patientId,
            UserDetails principal, boolean refreshSource) {
        if (document.getSourceType() != DocumentSourceType.APPOINTMENT_REMINDER) {
            return;
        }
        Appointment appointment = appointmentRepository
                .findById(document.getSourceRecordId()).orElse(null);
        if (refreshSource && appointment != null) {
            // findById alone can reuse the earlier persistence-context value.
            try {
                entityManager.refresh(appointment);
                // The reminder snapshot includes these display fields. Lazy
                // associations have no REFRESH cascade and may still contain
                // values initialized by the initial freshness check.
                entityManager.refresh(appointment.getPatient());
                entityManager.refresh(appointment.getDoctor());
                if (appointment.getBranch() != null) {
                    entityManager.refresh(appointment.getBranch());
                }
                if (appointment.getSpecialty() != null) {
                    entityManager.refresh(appointment.getSpecialty());
                }
            } catch (jakarta.persistence.EntityNotFoundException exception) {
                appointment = null;
            }
        }
        boolean eligible = appointment != null
                && appointment.getPatient().getId().equals(patientId)
                && appointment.getStatus() != AppointmentStatus.CANCELLED
                && appointment.getStatus() != AppointmentStatus.NO_SHOW;
        boolean current = eligible && reminderSnapshotMatches(document, appointment);
        if (!eligible || !current) {
            recordAuditSafely(principal, patientId, document.getId().toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY, null);
            throw new BusinessException(409, "Giấy nhắc hẹn đã lỗi thời; hãy tạo lại giấy nhắc mới");
        }
    }

    private int validatedDownloadSize(PatientDocument document) throws IOException {
        Long size = document.getByteSize();
        String sha = document.getSha256();
        if (size == null || size <= 0 || size > MAX_DOWNLOAD_BYTES
                || sha == null || !sha.matches("[0-9a-f]{64}")) {
            throw new DocumentContentUnavailableException("Invalid stored document integrity metadata");
        }
        return size.intValue();
    }

    /**
     * Resolves an appointment by its booking code and returns the already
     * generated APPOINTMENT_REMINDER document through the standard download
     * path (same authorization and status checks). A booking code owned by a
     * different patient or a document not generated yet yields the same
     * not-found response, so existence never leaks across patients.
     */
    @Transactional(readOnly = true)
    public DocumentDownload downloadAppointmentReminderByBookingCode(
            UUID patientId, String bookingCode, UserDetails principal) {
        authorizePatientScope(patientId, principal);
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No appointment found for booking code: " + bookingCode));
        if (!appointment.getPatient().getId().equals(patientId)) {
            throw new ResourceNotFoundException(
                    "No appointment found for booking code: " + bookingCode);
        }
        // Prefer the newest AVAILABLE row: duplicate rows should not occur
        // (supersede retires predecessors) but an unordered pick could select
        // a stale one and reject a valid download.
        PatientDocument document = documentRepository
                .findFirstByPatientIdAndSourceTypeAndSourceRecordIdAndStatusInOrderByGeneratedAtDesc(
                        patientId,
                        DocumentSourceType.APPOINTMENT_REMINDER,
                        appointment.getId(),
                        List.of(DocumentStatus.AVAILABLE))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Giấy nhắc hẹn chưa được tạo cho lịch hẹn này; hãy xuất tài liệu trước khi tải"));
        return downloadDocument(patientId, document.getId(), principal);
    }

    @Transactional
    public DocumentResponse revokeDocument(UUID patientId, UUID documentId, UserDetails principal) {
        try {
            authorizePatientScope(patientId, principal);
            PatientDocument document = documentRepository.findByIdAndPatientId(documentId, patientId)
                    .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + documentId));
            authorizeDocumentLifecycleMutation(document, principal);
            if (document.getStatus() != DocumentStatus.AVAILABLE
                    && document.getStatus() != DocumentStatus.SUPERSEDED
                    && document.getStatus() != DocumentStatus.REVOKED) {
                recordAuditSafely(principal, patientId, documentId.toString(),
                    ACTION_REVOKE, ClinicalAccessAuditService.DECISION_DENY, null);
                throw new BusinessException(409, "Chỉ tài liệu đã tạo thành công mới có thể thu hồi");
            }
            if (document.getStatus() != DocumentStatus.REVOKED) {
                document.setStatus(DocumentStatus.REVOKED);
                document.setRevokedAt(OffsetDateTime.now());
                document = documentRepository.saveAndFlush(document);
            }
            recordAuditSafely(principal, patientId, documentId.toString(),
                ACTION_REVOKE, ClinicalAccessAuditService.DECISION_ALLOW, null);
            return toResponse(document);
        } catch (AccessDeniedException exception) {
            recordAuditSafely(principal, patientId, documentId.toString(),
                ACTION_REVOKE, ClinicalAccessAuditService.DECISION_DENY, null);
            throw exception;
        }
    }

    // ── Snapshot building ───────────────────────────────────────────────────

    private DocumentSnapshot snapshotFromMedicalRecord(UUID patientId, UUID recordId, UserDetails principal) {
        MedicalRecord record = medicalRecordRepository.findByIdWithDetails(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found with ID: " + recordId));
        requireSourceAccess(record.getPatient().getId().equals(patientId), principal);
        authorizeMedicalRecordSource(record, principal);
        DocumentSnapshot.VisitSummaryPayload visit = new DocumentSnapshot.VisitSummaryPayload(
                record.getAppointment() != null ? record.getAppointment().getBookingCode() : null,
                record.getAppointment() != null ? record.getAppointment().getAppointmentTime() : null,
                record.getIcd10Code(),
                record.getIcd10Name(),
                record.getDiagnosis(),
                record.getSymptomsSummary(),
                record.getBloodPressureSystolic(),
                record.getBloodPressureDiastolic(),
                record.getHeartRate(),
                record.getTemperature(),
                record.getWeightKg(),
                record.getHeightCm(),
                record.getTreatmentPlan(),
                record.getDoctorNotes(),
                record.getFollowUpDate());
        return new DocumentSnapshot(
                DocumentSourceType.VISIT_SUMMARY,
                record.getId(),
                sourceVersion(record.getUpdatedAt()),
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                record.getPatient().getFullName(),
                record.getPatient().getPhone(),
                record.getDoctor().getFullName(),
                record.getCreatedAt(),
                visit,
                null,
                null);
    }

    private DocumentSnapshot snapshotFromPrescription(UUID patientId, UUID prescriptionId, UserDetails principal) {
        return snapshotFromPrescription(patientId, prescriptionId, principal, false);
    }

    private DocumentSnapshot snapshotFromPrescription(UUID patientId, UUID prescriptionId, UserDetails principal,
            boolean stableRecoveryOrder) {
        Prescription prescription = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Prescription not found with ID: " + prescriptionId));
        requireSourceAccess(prescription.getPatient().getId().equals(patientId), principal);
        authorizePrescriptionSource(prescription, principal);
        if (!"ACTIVE".equalsIgnoreCase(prescription.getStatus())) {
            throw new BusinessException(409, "Chỉ đơn thuốc đang hiệu lực mới có thể kết xuất PDF demo");
        }
        List<DocumentSnapshot.PrescriptionItemSnapshot> items = prescription.getItems() == null
                ? List.of()
                : (stableRecoveryOrder ? prescription.getItems().stream().sorted(java.util.Comparator.comparing(
                        com.healthcare.clinical.entity.PrescriptionItem::getId)) : prescription.getItems().stream())
                        .map(item -> new DocumentSnapshot.PrescriptionItemSnapshot(
                                item.getMedicationName(),
                                item.getActiveIngredient(),
                                item.getDosage(),
                                item.getUnit(),
                                item.getFrequency(),
                                item.getDurationDays(),
                                item.getTotalQuantity(),
                                item.getUsageNote()))
                        .toList();
        DocumentSnapshot.PrescriptionPayload payload = new DocumentSnapshot.PrescriptionPayload(
                prescription.getPrescriptionCode(),
                prescription.getDiagnosisSummary(),
                prescription.getGeneralAdvice(),
                prescription.getStatus(),
                items);
        return new DocumentSnapshot(
                DocumentSourceType.PRESCRIPTION,
                prescription.getId(),
                sourceVersion(prescription.getUpdatedAt()),
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                prescription.getPatient().getFullName(),
                prescription.getPatient().getPhone(),
                prescription.getDoctor().getFullName(),
                prescription.getCreatedAt(),
                null,
                payload,
                null);
    }

    private DocumentSnapshot snapshotFromAppointment(UUID patientId, UUID appointmentId, UserDetails principal) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appointment not found with ID: " + appointmentId));
        requireSourceAccess(appointment.getPatient().getId().equals(patientId), principal);
        authorizeAppointmentSource(appointment, principal);
        if (appointment.getStatus() == AppointmentStatus.CANCELLED
                || appointment.getStatus() == AppointmentStatus.NO_SHOW) {
            throw new BusinessException(409, "Chỉ lịch hẹn còn hiệu lực mới có thể kết xuất giấy nhắc hẹn");
        }
        return appointmentReminderSnapshot(appointment);
    }

    private DocumentSnapshot appointmentReminderSnapshot(Appointment appointment) {
        DocumentSnapshot.AppointmentReminderPayload payload =
                new DocumentSnapshot.AppointmentReminderPayload(
                        appointment.getBookingCode(),
                        appointment.getAppointmentDate(),
                        appointment.getStartTime(),
                        appointment.getEndTime(),
                        appointment.getBranch() != null ? appointment.getBranch().getName() : null,
                        appointment.getSpecialty() != null ? appointment.getSpecialty().getName() : null,
                        appointment.getReasonForVisit());
        DocumentSnapshot base = new DocumentSnapshot(
                DocumentSourceType.APPOINTMENT_REMINDER,
                appointment.getId(),
                0L,
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                appointment.getPatient().getFullName(),
                appointment.getPatient().getPhone(),
                appointment.getDoctor().getFullName(),
                appointment.getCreatedAt(),
                null,
                null,
                payload);
        String digest = snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(base));
        long sourceVersion = Math.max(1L, Long.parseLong(digest.substring(0, 13), 16));
        return new DocumentSnapshot(
                DocumentSourceType.APPOINTMENT_REMINDER,
                appointment.getId(),
                sourceVersion,
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                appointment.getPatient().getFullName(),
                appointment.getPatient().getPhone(),
                appointment.getDoctor().getFullName(),
                appointment.getCreatedAt(),
                null,
                null,
                payload);
    }

    private void authorizeAppointmentSource(Appointment appointment, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            if (!requireLinkedDoctor(principal).getId().equals(appointment.getDoctor().getId())) {
                throw new AccessDeniedException("The authenticated doctor is not assigned to this appointment");
            }
            return;
        }
        throw new AccessDeniedException("Document generation denied");
    }

    private void authorizeMedicalRecordSource(MedicalRecord record, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            // Ownership of the source was already checked against the path.
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            if (!requireLinkedDoctor(principal).getId().equals(record.getDoctor().getId())) {
                throw new AccessDeniedException("The authenticated doctor did not issue this record");
            }
            return;
        }
        throw new AccessDeniedException("Document generation denied");
    }

    private void authorizePrescriptionSource(Prescription prescription, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            if (!requireLinkedDoctor(principal).getId().equals(prescription.getDoctor().getId())) {
                throw new AccessDeniedException("The authenticated doctor did not issue this prescription");
            }
            return;
        }
        throw new AccessDeniedException("Document generation denied");
    }

    private void requireSourceAccess(boolean sourceMatchesPatient, UserDetails principal) {
        requireAuthenticated(principal);
        if (!sourceMatchesPatient) {
            // The path names a patient but the source belongs to someone else;
            // never leak existence across patients.
            throw new AccessDeniedException("The requested source record does not belong to this patient");
        }
    }

    // ── Authorization ───────────────────────────────────────────────────────

    /**
     * Scope check against the patient path segment: owning patient, any doctor
     * with a clinical relationship (their issued-document filter is applied on
     * top), or an administrator.
     */
    private void authorizePatientScope(UUID patientId, UserDetails principal) {
        requireAuthenticated(principal);
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            if (!requireLinkedPatient(principal).getId().equals(patientId)) {
                throw new AccessDeniedException("The authenticated patient cannot access documents of another patient");
            }
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            ensureDoctorCanAccessPatient(patientId, requireLinkedDoctor(principal).getId());
            return;
        }
        throw new AccessDeniedException("Document access denied");
    }

    private Map<DocumentSourceType, Set<UUID>> issuedSourceIds(UUID patientId, Doctor doctor) {
        Map<DocumentSourceType, Set<UUID>> ids = new EnumMap<>(DocumentSourceType.class);
        for (MedicalRecord record : medicalRecordRepository
                .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctor.getId())) {
            ids.computeIfAbsent(DocumentSourceType.VISIT_SUMMARY, key -> new HashSet<>())
                    .add(record.getId());
        }
        for (Prescription prescription : prescriptionRepository
                .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctor.getId())) {
            ids.computeIfAbsent(DocumentSourceType.PRESCRIPTION, key -> new HashSet<>())
                    .add(prescription.getId());
        }
        ids.put(DocumentSourceType.APPOINTMENT_REMINDER,
                new HashSet<>(appointmentRepository.findDocumentSourceIdsForDoctor(patientId, doctor.getId())));
        return ids;
    }

    private void authorizeDocumentRead(PatientDocument document, UserDetails principal) {
        if (hasRole(principal, "ADMIN") || hasRole(principal, "PATIENT")) {
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            Map<DocumentSourceType, Set<UUID>> issuedSourceIds =
                    issuedSourceIds(document.getPatient().getId(), requireLinkedDoctor(principal));
            if (issuedSourceIds.getOrDefault(document.getSourceType(), Set.of())
                    .contains(document.getSourceRecordId())) {
                return;
            }
        }
        throw new AccessDeniedException("Document access denied");
    }

    private void authorizeDocumentLifecycleMutation(PatientDocument document, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            Map<DocumentSourceType, Set<UUID>> issuedSourceIds =
                    issuedSourceIds(document.getPatient().getId(), requireLinkedDoctor(principal));
            if (issuedSourceIds.getOrDefault(document.getSourceType(), Set.of())
                    .contains(document.getSourceRecordId())) {
                return;
            }
        }
        throw new AccessDeniedException("Document lifecycle mutation denied");
    }

    private void ensureDoctorCanAccessPatient(UUID patientId, UUID doctorId) {
        boolean hasRecord = medicalRecordRepository.existsByPatientIdAndDoctorId(patientId, doctorId);
        boolean hasAssignedVisit = appointmentRepository.existsByPatientIdAndDoctorIdAndStatusIn(
            patientId,
            doctorId,
            EnumSet.of(
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED
            )
        );
        if (!hasRecord && !hasAssignedVisit) {
            throw new AccessDeniedException("The doctor has no clinical relationship with this patient");
        }
    }

    private PatientProfile requireLinkedPatient(UserDetails principal) {
        return patientProfileRepository.findByUserId(resolveUserId(principal))
                .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
    }

    private Doctor requireLinkedDoctor(UserDetails principal) {
        return doctorRepository.findByUserId(resolveUserId(principal))
                .orElseThrow(() -> new AccessDeniedException("No doctor profile is linked to this account"));
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findById(resolveUserId(principal))
                .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private UUID resolveUserId(UserDetails principal) {
        requireAuthenticated(principal);
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        return userRepository.findByEmail(principal.getUsername())
                .map(User::getId)
                .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private void requireAuthenticated(UserDetails principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }
    }

    private boolean hasRole(UserDetails principal, String role) {
        return principal != null && principal.getAuthorities().stream()
                .anyMatch(authority -> ("ROLE_" + role).equals(authority.getAuthority()));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String buildIdempotencyKey(DocumentSnapshot snapshot) {
        String revision = snapshot.sourceType() == DocumentSourceType.APPOINTMENT_REMINDER
                ? snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(snapshot))
                : Long.toString(snapshot.sourceVersion());
        return snapshot.sourceType().name() + ":" + snapshot.sourceRecordId()
            + ":" + revision + ":" + snapshot.templateVersion();
    }

    private static long sourceVersion(OffsetDateTime updatedAt) {
        return updatedAt == null ? 0L : updatedAt.toInstant().toEpochMilli();
    }

    private byte[] render(DocumentSnapshot snapshot, String snapshotHash) {
        try {
            return switch (snapshot.sourceType()) {
                case VISIT_SUMMARY -> renderer.renderVisitSummary(snapshot, snapshotHash);
                case PRESCRIPTION -> renderer.renderPrescription(snapshot, snapshotHash);
                case APPOINTMENT_REMINDER -> renderer.renderAppointmentReminder(snapshot, snapshotHash);
            };
        } catch (IOException exception) {
            throw new BusinessException(500, "Không thể kết xuất tài liệu tổng hợp");
        }
    }

    private DocumentResponse toResponse(PatientDocument document) {
        if (document.getSourceType() == DocumentSourceType.APPOINTMENT_REMINDER) {
            return toResponse(document, appointmentRepository
                    .findById(document.getSourceRecordId()).orElse(null));
        }
        return toResponse(document, null);
    }

    private DocumentResponse toResponse(PatientDocument document, Appointment reminderSource) {
        Boolean sourceCurrent = null;
        Boolean sourceEligible = null;
        if (document.getSourceType() == DocumentSourceType.APPOINTMENT_REMINDER) {
            Appointment appointment = reminderSource;
            sourceEligible = appointment != null
                    && appointment.getPatient().getId().equals(document.getPatient().getId())
                    && appointment.getStatus() != AppointmentStatus.CANCELLED
                    && appointment.getStatus() != AppointmentStatus.NO_SHOW;
            sourceCurrent = Boolean.TRUE.equals(sourceEligible) && reminderSnapshotMatches(document, appointment);
        }
        return new DocumentResponse(
                document.getId(),
                document.getPatient().getId(),
                document.getSourceRecordId(),
                document.getSourceType(),
                document.getSourceVersion(),
                document.getTemplateVersion(),
                document.getStatus(),
                document.getSha256(),
                document.getByteSize(),
                document.getGeneratedBy().getId(),
                document.getGeneratedAt(),
                document.getRevokedAt(),
                sourceCurrent,
                sourceEligible,
                document.getRegeneratedFromDocumentId(),
                document.getSourceSnapshotSha256(),
                document.getRecoveryReason());
    }

    private boolean reminderSnapshotMatches(PatientDocument document, Appointment appointment) {
        DocumentSnapshot snapshot = appointmentReminderSnapshot(appointment);
        return document.getRegeneratedFromDocumentId() != null
                ? snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(snapshot)).equals(document.getSourceSnapshotSha256())
                : buildIdempotencyKey(snapshot).equals(document.getIdempotencyKey());
    }
}
