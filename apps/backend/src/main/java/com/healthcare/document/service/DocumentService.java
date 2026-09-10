package com.healthcare.document.service;

import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.entity.Prescription;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Synthetic clinical document generation, listing and authorized download
 * (ADR-005 / D-03). Only VISIT_SUMMARY and PRESCRIPTION classes exist; every
 * artifact is a demo export. Ownership model: the owning patient, the doctor
 * who issued the source record, or an administrator.
 */
@Service
public class DocumentService {

    public static final String TARGET_DOCUMENT = "DOCUMENT";
    public static final String ACTION_GENERATE = "GENERATE";
    public static final String ACTION_REVOKE = "REVOKE";
    public static final String DOCUMENT_CONTENT_TYPE = "application/pdf";
    static final String OBJECT_KEY_PREFIX = "documents/";

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
            ClinicalAccessAuditService auditService) {
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
    }

    public record DocumentDownload(PatientDocument document, InputStream stream) {
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public DocumentResponse generateDocument(
            UUID patientId,
            GenerateDocumentRequest request,
            UserDetails principal) {
        authorizePatientScope(patientId, principal);
        PatientProfile patient = patientProfileRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));

        DocumentSnapshot snapshot = switch (request.sourceType()) {
            case VISIT_SUMMARY -> snapshotFromMedicalRecord(patientId, request.sourceRecordId(), principal);
            case PRESCRIPTION -> snapshotFromPrescription(patientId, request.sourceRecordId(), principal);
        };

        String idempotencyKey = buildIdempotencyKey(snapshot);
        PatientDocument existing = documentRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existing != null && existing.getStatus() != DocumentStatus.FAILED) {
            // Idempotent regeneration: same key returns the same row and never
            // writes a second object.
            auditService.record(principal, patientId, TARGET_DOCUMENT,
                existing.getId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW);
            return toResponse(existing);
        }

        User generatedBy = resolveUser(principal);
        String snapshotHash = snapshotCodec.sha256Hex(snapshotCodec.canonicalJson(snapshot));
        byte[] pdfBytes = render(snapshot, snapshotHash);
        if (existing != null) {
            // Retry a previously failed object write in place. The idempotency
            // key still points at one row, but a transient MinIO outage does
            // not permanently brick this source/version/template.
            existing.setStatus(DocumentStatus.PENDING);
            existing.setGeneratedBy(generatedBy);
            existing.setSha256(null);
            existing.setByteSize(null);
            PatientDocument retry = documentRepository.saveAndFlush(existing);
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
            // A concurrent request claimed the same idempotency key first; the
            // winner's row is authoritative for both callers.
            PatientDocument concurrent = documentRepository.findByIdempotencyKey(idempotencyKey)
                    .orElseThrow(() -> exception);
            auditService.record(principal, patientId, TARGET_DOCUMENT,
                concurrent.getId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW);
            return toResponse(concurrent);
        }

        return storeAndFinalize(document, patientId, principal, pdfBytes);
    }

    private DocumentResponse storeAndFinalize(
            PatientDocument document,
            UUID patientId,
            UserDetails principal,
            byte[] pdfBytes) {
        boolean objectUploaded = false;
        try {
            objectStore.put(document.getObjectKey(), pdfBytes, DOCUMENT_CONTENT_TYPE);
            objectUploaded = true;
            cleanupService.trackCandidate(document.getObjectKey());
        } catch (Exception exception) {
            if (objectUploaded) {
                cleanupStoredObject(document.getObjectKey(), exception);
            }
            // ADR-005 requires failed generation attempts to remain visible and
            // recoverable instead of disappearing as a rollback-only side effect.
            document.setStatus(DocumentStatus.FAILED);
            documentRepository.saveAndFlush(document);
            auditService.record(principal, patientId, TARGET_DOCUMENT,
                document.getId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_DENY);
            throw new BusinessException(503, "Không thể lưu tài liệu vào kho đối tượng");
        }

        PatientDocument saved;
        try {
            document.setStatus(DocumentStatus.AVAILABLE);
            document.setSha256(snapshotCodec.sha256Hex(pdfBytes));
            document.setByteSize((long) pdfBytes.length);
            saved = documentRepository.saveAndFlush(document);
            supersedePreviousAvailableVersions(saved);
            resolveCleanupAfterCommit(saved.getObjectKey());
        } catch (RuntimeException exception) {
            cleanupStoredObject(document.getObjectKey(), exception);
            throw exception;
        }
        auditService.record(principal, patientId, TARGET_DOCUMENT,
            saved.getId().toString(), ACTION_GENERATE, ClinicalAccessAuditService.DECISION_ALLOW);
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

    private void resolveCleanupAfterCommit(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            cleanupService.resolveCandidate(objectKey);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                cleanupService.resolveCandidate(objectKey);
            }
        });
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
                Set<UUID> issuedSourceIds = issuedSourceIds(patientId, requireLinkedDoctor(principal));
                documents = documents.stream()
                        .filter(document -> issuedSourceIds.contains(document.getSourceRecordId()))
                        .toList();
            }
            auditService.record(principal, patientId, TARGET_DOCUMENT, patientId.toString(),
                ClinicalAccessAuditService.ACTION_READ, ClinicalAccessAuditService.DECISION_ALLOW);
            return documents.stream().map(this::toResponse).toList();
        } catch (AccessDeniedException exception) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, patientId.toString(),
                ClinicalAccessAuditService.ACTION_READ, ClinicalAccessAuditService.DECISION_DENY);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public DocumentDownload downloadDocument(UUID patientId, UUID documentId, UserDetails principal) {
        try {
            authorizePatientScope(patientId, principal);
        } catch (AccessDeniedException exception) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY);
            throw exception;
        }
        PatientDocument document = documentRepository.findByIdAndPatientId(documentId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + documentId));
        try {
            authorizeDocumentRead(document, principal);
        } catch (AccessDeniedException exception) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY);
            throw exception;
        }
        if (document.getStatus() == DocumentStatus.REVOKED
                || document.getStatus() == DocumentStatus.SUPERSEDED) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY);
            throw new AccessDeniedException("Tài liệu đã bị thu hồi hoặc thay thế và không thể tải xuống");
        }
        if (document.getStatus() != DocumentStatus.AVAILABLE) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY);
            throw new BusinessException(409, "Tài liệu chưa sẵn sàng để tải xuống");
        }
        if (!objectStore.isConfigured()) {
            throw new BusinessException(503, "Kho đối tượng chưa được cấu hình");
        }
        try {
            InputStream stream = objectStore.get(document.getObjectKey());
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_ALLOW);
            return new DocumentDownload(document, stream);
        } catch (Exception exception) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ClinicalAccessAuditService.ACTION_DOWNLOAD, ClinicalAccessAuditService.DECISION_DENY);
            throw new BusinessException(503, "Không thể đọc tài liệu từ kho đối tượng");
        }
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
                auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                    ACTION_REVOKE, ClinicalAccessAuditService.DECISION_DENY);
                throw new BusinessException(409, "Chỉ tài liệu đã tạo thành công mới có thể thu hồi");
            }
            if (document.getStatus() != DocumentStatus.REVOKED) {
                document.setStatus(DocumentStatus.REVOKED);
                document.setRevokedAt(OffsetDateTime.now());
                document = documentRepository.saveAndFlush(document);
            }
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ACTION_REVOKE, ClinicalAccessAuditService.DECISION_ALLOW);
            return toResponse(document);
        } catch (AccessDeniedException exception) {
            auditService.record(principal, patientId, TARGET_DOCUMENT, documentId.toString(),
                ACTION_REVOKE, ClinicalAccessAuditService.DECISION_DENY);
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
                null);
    }

    private DocumentSnapshot snapshotFromPrescription(UUID patientId, UUID prescriptionId, UserDetails principal) {
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
                : prescription.getItems().stream()
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
                payload);
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

    private Set<UUID> issuedSourceIds(UUID patientId, Doctor doctor) {
        Set<UUID> ids = new HashSet<>();
        for (MedicalRecord record : medicalRecordRepository
                .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctor.getId())) {
            ids.add(record.getId());
        }
        for (Prescription prescription : prescriptionRepository
                .findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctor.getId())) {
            ids.add(prescription.getId());
        }
        return ids;
    }

    private void authorizeDocumentRead(PatientDocument document, UserDetails principal) {
        if (hasRole(principal, "ADMIN") || hasRole(principal, "PATIENT")) {
            return;
        }
        if (hasRole(principal, "DOCTOR")) {
            Set<UUID> issuedSourceIds = issuedSourceIds(document.getPatient().getId(), requireLinkedDoctor(principal));
            if (issuedSourceIds.contains(document.getSourceRecordId())) {
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
            Set<UUID> issuedSourceIds = issuedSourceIds(document.getPatient().getId(), requireLinkedDoctor(principal));
            if (issuedSourceIds.contains(document.getSourceRecordId())) {
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

    static String buildIdempotencyKey(DocumentSnapshot snapshot) {
        return snapshot.sourceType().name() + ":" + snapshot.sourceRecordId()
            + ":" + snapshot.sourceVersion() + ":" + snapshot.templateVersion();
    }

    private static long sourceVersion(OffsetDateTime updatedAt) {
        return updatedAt == null ? 0L : updatedAt.toInstant().toEpochMilli();
    }

    private byte[] render(DocumentSnapshot snapshot, String snapshotHash) {
        try {
            return switch (snapshot.sourceType()) {
                case VISIT_SUMMARY -> renderer.renderVisitSummary(snapshot, snapshotHash);
                case PRESCRIPTION -> renderer.renderPrescription(snapshot, snapshotHash);
            };
        } catch (IOException exception) {
            throw new BusinessException(500, "Không thể kết xuất tài liệu tổng hợp");
        }
    }

    private DocumentResponse toResponse(PatientDocument document) {
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
                document.getRevokedAt());
    }
}
