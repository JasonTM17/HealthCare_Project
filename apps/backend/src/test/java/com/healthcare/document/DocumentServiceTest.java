package com.healthcare.document;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
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
import com.healthcare.document.service.DocumentObjectCleanupService;
import com.healthcare.document.service.DocumentObjectStore;
import com.healthcare.document.service.DocumentService;
import com.healthcare.document.service.DocumentSnapshotCodec;
import com.healthcare.document.service.SyntheticPdfRenderer;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Focused authorization/idempotency/integrity behavior of the synthetic
 * document service (ADR-005). Object storage and repositories are mocked;
 * renderer determinism itself is pinned by {@link SyntheticPdfRendererTest}.
 */
class DocumentServiceTest {

    private static final UUID PATIENT_ID = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID OTHER_PATIENT_ID = UUID.fromString("00000000-0000-4000-8000-0000000000a2");
    private static final UUID DOCTOR_ID = UUID.fromString("00000000-0000-4000-8000-0000000000b1");
    private static final UUID OTHER_DOCTOR_ID = UUID.fromString("00000000-0000-4000-8000-0000000000b2");
    private static final UUID USER_ID = UUID.fromString("00000000-0000-4000-8000-0000000000c1");
    private static final UUID DOCUMENT_ID = UUID.fromString("00000000-0000-4000-8000-0000000000f1");
    private static final UUID FOREIGN_DOCUMENT_ID = UUID.fromString("00000000-0000-4000-8000-0000000000f2");
    private static final UUID RECORD_ID = UUID.fromString("00000000-0000-4000-8000-0000000000d1");
    private static final long SOURCE_VERSION = 1772359200000L;
    private static final byte[] RENDERED_PDF = "%PDF-1.6 fixed service fixture".getBytes(StandardCharsets.US_ASCII);

    private PatientDocumentRepository documentRepository;
    private MedicalRecordRepository medicalRecordRepository;
    private PrescriptionRepository prescriptionRepository;
    private PatientProfileRepository patientProfileRepository;
    private DoctorRepository doctorRepository;
    private UserRepository userRepository;
    private DocumentObjectStore objectStore;
    private DocumentObjectCleanupService cleanupService;
    private SyntheticPdfRenderer renderer;
    private ClinicalAccessAuditService auditService;
    private DocumentService service;
    private DocumentSnapshotCodec codec;

    @BeforeEach
    void setUp() {
        documentRepository = mock(PatientDocumentRepository.class);
        medicalRecordRepository = mock(MedicalRecordRepository.class);
        prescriptionRepository = mock(PrescriptionRepository.class);
        patientProfileRepository = mock(PatientProfileRepository.class);
        doctorRepository = mock(DoctorRepository.class);
        userRepository = mock(UserRepository.class);
        objectStore = mock(DocumentObjectStore.class);
        cleanupService = mock(DocumentObjectCleanupService.class);
        renderer = mock(SyntheticPdfRenderer.class);
        auditService = mock(ClinicalAccessAuditService.class);
        codec = new DocumentSnapshotCodec();
        service = new DocumentService(documentRepository, medicalRecordRepository,
                prescriptionRepository, patientProfileRepository, doctorRepository,
                userRepository, mock(AppointmentRepository.class), objectStore, cleanupService, renderer,
                codec, auditService);
    }

    @Test
    void patientCannotGenerateDocumentForAnotherPatientsSourceRecord() throws Exception {
        MedicalRecord foreignRecord = medicalRecord(OTHER_PATIENT_ID, DOCTOR_ID);
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(foreignRecord));
        stubPatientExists(PATIENT_ID);

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).put(anyString(), any(), anyString());
        verify(documentRepository, never()).saveAndFlush(any());
    }

    @Test
    void doctorCannotGenerateDocumentForRecordTheyDidNotIssue() throws Exception {
        MedicalRecord foreignIssuedRecord = medicalRecord(PATIENT_ID, OTHER_DOCTOR_ID);
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(foreignIssuedRecord));
        stubPatientExists(PATIENT_ID);
        stubDoctorRelationship(PATIENT_ID, DOCTOR_ID);

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                doctorPrincipal(DOCTOR_ID)))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).put(anyString(), any(), anyString());
    }

    @Test
    void patientCannotListOrDownloadAnotherPatientsDocuments() throws Exception {
        assertThatThrownBy(() -> service.listDocuments(OTHER_PATIENT_ID, patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        assertThatThrownBy(() -> service.downloadDocument(OTHER_PATIENT_ID,
                UUID.randomUUID(), patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).get(anyString());
        verify(documentRepository, never()).findByPatientIdOrderByGeneratedAtDesc(OTHER_PATIENT_ID);
    }

    @Test
    void unknownSourceRecordIsNotFoundNotAccepted() {
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.empty());
        stubPatientExists(PATIENT_ID);

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void regenerationWithSameIdempotencyKeyReturnsExistingRowWithoutSecondObject() throws Exception {
        PatientDocument existing = availableDocument();
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID))
                .thenReturn(Optional.of(ownRecord));
        stubPatientExists(PATIENT_ID);
        when(documentRepository.findByIdempotencyKey(anyString()))
                .thenReturn(Optional.of(existing));

        DocumentResponse response = service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal());

        assertThat(response.id()).isEqualTo(existing.getId());
        verify(objectStore, never()).put(anyString(), any(), anyString());
        verify(documentRepository, never()).saveAndFlush(any());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(existing.getId().toString()), eq(DocumentService.ACTION_GENERATE),
                eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void generationPersistsAvailableRowWithPdfByteHashAndSingleObject() throws Exception {
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        PatientProfile patient = patientMock(PATIENT_ID);
        User generator = userMock();
        when(documentRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(ownRecord));
        when(renderer.renderVisitSummary(any(), anyString())).thenReturn(RENDERED_PDF);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(generator));
        when(patientProfileRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));
        List<DocumentStatus> savedStatuses = new ArrayList<>();
        when(documentRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> {
                    PatientDocument document = assignDocumentId(invocation.getArgument(0));
                    savedStatuses.add(document.getStatus());
                    return document;
                });

        DocumentResponse response = service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal());

        ArgumentCaptor<PatientDocument> saved = ArgumentCaptor.forClass(PatientDocument.class);
        verify(documentRepository, times(2)).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getIdempotencyKey())
                .isEqualTo("VISIT_SUMMARY:" + RECORD_ID + ":" + SOURCE_VERSION + ":1.0");
        assertThat(savedStatuses).containsExactly(DocumentStatus.PENDING, DocumentStatus.AVAILABLE);
        assertThat(response.status()).isEqualTo(DocumentStatus.AVAILABLE);
        assertThat(response.sha256()).isEqualTo(codec.sha256Hex(RENDERED_PDF));
        assertThat(response.byteSize()).isEqualTo((long) RENDERED_PDF.length);
        verify(objectStore).put(anyString(), eq(RENDERED_PDF), eq("application/pdf"));
        verify(cleanupService).trackCandidate(saved.getValue().getObjectKey());
        verify(cleanupService).resolveCandidate(saved.getValue().getObjectKey());
    }

    @Test
    void generationSupersedesPreviousAvailableVersionForSameSource() throws Exception {
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        PatientProfile patient = patientMock(PATIENT_ID);
        User generator = userMock();
        PatientDocument previous = availableDocument(
                UUID.fromString("00000000-0000-4000-8000-0000000000f3"), RECORD_ID);
        previous.setSourceVersion(SOURCE_VERSION - 1);
        previous.setIdempotencyKey("VISIT_SUMMARY:" + RECORD_ID + ":" + (SOURCE_VERSION - 1) + ":1.0");
        when(documentRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(ownRecord));
        when(renderer.renderVisitSummary(any(), anyString())).thenReturn(RENDERED_PDF);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(generator));
        when(patientProfileRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));
        when(documentRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> assignDocumentId(invocation.getArgument(0)));
        when(documentRepository.findByPatientIdAndSourceTypeAndSourceRecordIdAndStatusIn(
                eq(PATIENT_ID), eq(DocumentSourceType.VISIT_SUMMARY), eq(RECORD_ID), any()))
                .thenReturn(List.of(previous));

        DocumentResponse response = service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal());

        assertThat(response.status()).isEqualTo(DocumentStatus.AVAILABLE);
        assertThat(previous.getStatus()).isEqualTo(DocumentStatus.SUPERSEDED);
        assertThat(previous.getRevokedAt()).isNotNull();
        verify(documentRepository).saveAll(eq(List.of(previous)));
        verify(cleanupService).trackCandidate(anyString());
        verify(cleanupService).resolveCandidate(anyString());
    }

    @Test
    void objectStoreFailurePersistsFailedRowAndSurfacesUnavailable() throws Exception {
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        PatientProfile patient = patientMock(PATIENT_ID);
        User generator = userMock();
        when(documentRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(ownRecord));
        when(renderer.renderVisitSummary(any(), anyString())).thenReturn(RENDERED_PDF);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(generator));
        when(patientProfileRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));
        List<DocumentStatus> savedStatuses = new ArrayList<>();
        when(documentRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> {
                    PatientDocument document = assignDocumentId(invocation.getArgument(0));
                    savedStatuses.add(document.getStatus());
                    return document;
                });
        doThrow(new RuntimeException("minio unavailable"))
                .when(objectStore).put(anyString(), eq(RENDERED_PDF), eq("application/pdf"));

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal()))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(503);

        ArgumentCaptor<PatientDocument> saved = ArgumentCaptor.forClass(PatientDocument.class);
        verify(documentRepository, times(2)).saveAndFlush(saved.capture());
        assertThat(savedStatuses).containsExactly(DocumentStatus.PENDING, DocumentStatus.FAILED);
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(DOCUMENT_ID.toString()), eq(DocumentService.ACTION_GENERATE),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void databaseFinalizationFailureDeletesUploadedObject() throws Exception {
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        PatientProfile patient = patientMock(PATIENT_ID);
        User generator = userMock();
        RuntimeException finalizeFailure = new RuntimeException("db finalization failed");
        when(documentRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(ownRecord));
        when(renderer.renderVisitSummary(any(), anyString())).thenReturn(RENDERED_PDF);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(generator));
        when(patientProfileRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));
        List<DocumentStatus> savedStatuses = new ArrayList<>();
        when(documentRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> {
                    PatientDocument document = assignDocumentId(invocation.getArgument(0));
                    savedStatuses.add(document.getStatus());
                    if (savedStatuses.size() == 2) {
                        throw finalizeFailure;
                    }
                    return document;
                });

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal()))
                .isSameAs(finalizeFailure);

        assertThat(savedStatuses).containsExactly(DocumentStatus.PENDING, DocumentStatus.AVAILABLE);
        verify(objectStore).put(anyString(), eq(RENDERED_PDF), eq("application/pdf"));
        verify(objectStore).delete(anyString());
        verify(cleanupService).trackCandidate(anyString());
        verify(cleanupService).resolveCandidate(anyString());
    }

    @Test
    void failedDocumentRetryReusesRowAndWritesObject() throws Exception {
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        PatientProfile patient = patientMock(PATIENT_ID);
        User generator = userMock();
        PatientDocument failed = availableDocument();
        failed.setStatus(DocumentStatus.FAILED);
        failed.setSha256(null);
        failed.setByteSize(null);
        when(documentRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.of(failed));
        when(medicalRecordRepository.findByIdWithDetails(RECORD_ID)).thenReturn(Optional.of(ownRecord));
        when(renderer.renderVisitSummary(any(), anyString())).thenReturn(RENDERED_PDF);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(generator));
        when(patientProfileRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));
        List<DocumentStatus> savedStatuses = new ArrayList<>();
        when(documentRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> {
                    PatientDocument document = assignDocumentId(invocation.getArgument(0));
                    savedStatuses.add(document.getStatus());
                    return document;
                });

        DocumentResponse response = service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.VISIT_SUMMARY, RECORD_ID),
                patientPrincipal());

        verify(documentRepository, times(2)).saveAndFlush(failed);
        assertThat(savedStatuses).containsExactly(DocumentStatus.PENDING, DocumentStatus.AVAILABLE);
        assertThat(response.id()).isEqualTo(failed.getId());
        assertThat(response.status()).isEqualTo(DocumentStatus.AVAILABLE);
        assertThat(response.sha256()).isEqualTo(codec.sha256Hex(RENDERED_PDF));
        assertThat(response.byteSize()).isEqualTo((long) RENDERED_PDF.length);
        verify(objectStore).put(eq(failed.getObjectKey()), eq(RENDERED_PDF), eq("application/pdf"));
        verify(cleanupService).trackCandidate(failed.getObjectKey());
        verify(cleanupService).resolveCandidate(failed.getObjectKey());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(failed.getId().toString()), eq(DocumentService.ACTION_GENERATE),
                eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void cancelledPrescriptionCannotGeneratePdf() throws Exception {
        Prescription cancelled = prescription(PATIENT_ID, DOCTOR_ID, "CANCELLED");
        when(prescriptionRepository.findById(RECORD_ID)).thenReturn(Optional.of(cancelled));
        stubPatientExists(PATIENT_ID);

        assertThatThrownBy(() -> service.generateDocument(PATIENT_ID,
                new GenerateDocumentRequest(DocumentSourceType.PRESCRIPTION, RECORD_ID),
                patientPrincipal()))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(409);

        verify(objectStore, never()).put(anyString(), any(), anyString());
        verify(documentRepository, never()).saveAndFlush(any());
    }

    @Test
    void revokedDocumentDownloadIsDenied() throws Exception {
        PatientDocument revoked = availableDocument();
        revoked.setStatus(DocumentStatus.REVOKED);
        revoked.setRevokedAt(OffsetDateTime.now());
        when(documentRepository.findByIdAndPatientId(revoked.getId(), PATIENT_ID))
                .thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> service.downloadDocument(PATIENT_ID, revoked.getId(), patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).get(anyString());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(revoked.getId().toString()), eq(ClinicalAccessAuditService.ACTION_DOWNLOAD),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void supersededDocumentDownloadIsDenied() throws Exception {
        PatientDocument superseded = availableDocument();
        superseded.setStatus(DocumentStatus.SUPERSEDED);
        superseded.setRevokedAt(OffsetDateTime.now());
        when(documentRepository.findByIdAndPatientId(superseded.getId(), PATIENT_ID))
                .thenReturn(Optional.of(superseded));

        assertThatThrownBy(() -> service.downloadDocument(PATIENT_ID, superseded.getId(), patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).get(anyString());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(superseded.getId().toString()), eq(ClinicalAccessAuditService.ACTION_DOWNLOAD),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void issuingDoctorCanRevokeDocumentWithoutDeletingObject() throws Exception {
        PatientDocument document = availableDocument();
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        when(documentRepository.findByIdAndPatientId(document.getId(), PATIENT_ID))
                .thenReturn(Optional.of(document));
        when(documentRepository.saveAndFlush(document)).thenReturn(document);
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of(ownRecord));
        when(prescriptionRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of());
        stubDoctorRelationship(PATIENT_ID, DOCTOR_ID);

        DocumentResponse response = service.revokeDocument(PATIENT_ID, document.getId(), doctorPrincipal(DOCTOR_ID));

        assertThat(response.status()).isEqualTo(DocumentStatus.REVOKED);
        assertThat(response.revokedAt()).isNotNull();
        verify(objectStore, never()).delete(anyString());
        verify(documentRepository).saveAndFlush(document);
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(document.getId().toString()), eq(DocumentService.ACTION_REVOKE),
                eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void patientCannotRevokeTheirOwnSyntheticDocument() {
        PatientDocument document = availableDocument();
        when(documentRepository.findByIdAndPatientId(document.getId(), PATIENT_ID))
                .thenReturn(Optional.of(document));

        assertThatThrownBy(() -> service.revokeDocument(PATIENT_ID, document.getId(), patientPrincipal()))
                .isInstanceOf(AccessDeniedException.class);

        verify(documentRepository, never()).saveAndFlush(any());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(document.getId().toString()), eq(DocumentService.ACTION_REVOKE),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void failedDocumentCannotBeRevokedWithoutObjectMetadata() throws Exception {
        PatientDocument document = availableDocument();
        document.setStatus(DocumentStatus.FAILED);
        document.setSha256(null);
        document.setByteSize(null);
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        when(documentRepository.findByIdAndPatientId(document.getId(), PATIENT_ID))
                .thenReturn(Optional.of(document));
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of(ownRecord));
        when(prescriptionRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of());
        stubDoctorRelationship(PATIENT_ID, DOCTOR_ID);

        assertThatThrownBy(() -> service.revokeDocument(PATIENT_ID, document.getId(), doctorPrincipal(DOCTOR_ID)))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(409);

        verify(documentRepository, never()).saveAndFlush(any());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(document.getId().toString()), eq(DocumentService.ACTION_REVOKE),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void availableDocumentDownloadStreamsFromObjectStore() throws Exception {
        PatientDocument document = availableDocument();
        when(documentRepository.findByIdAndPatientId(document.getId(), PATIENT_ID))
                .thenReturn(Optional.of(document));
        ByteArrayInputStream stream = new ByteArrayInputStream(RENDERED_PDF);
        when(objectStore.get(document.getObjectKey())).thenReturn(stream);
        when(objectStore.isConfigured()).thenReturn(true);

        DocumentService.DocumentDownload download =
                service.downloadDocument(PATIENT_ID, document.getId(), patientPrincipal());

        assertThat(download.document().getId()).isEqualTo(document.getId());
        assertThat(download.stream()).isSameAs(stream);
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(document.getId().toString()), eq(ClinicalAccessAuditService.ACTION_DOWNLOAD),
                eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void doctorCannotDownloadDocumentIssuedByAnotherDoctor() throws Exception {
        UUID foreignSourceId = UUID.fromString("00000000-0000-4000-8000-0000000000e2");
        PatientDocument document = availableDocument(FOREIGN_DOCUMENT_ID, foreignSourceId);
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        when(documentRepository.findByIdAndPatientId(document.getId(), PATIENT_ID))
                .thenReturn(Optional.of(document));
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of(ownRecord));
        when(prescriptionRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of());
        stubDoctorRelationship(PATIENT_ID, DOCTOR_ID);

        assertThatThrownBy(() -> service.downloadDocument(PATIENT_ID, document.getId(), doctorPrincipal(DOCTOR_ID)))
                .isInstanceOf(AccessDeniedException.class);

        verify(objectStore, never()).get(anyString());
        verify(auditService).record(any(), eq(PATIENT_ID), eq(DocumentService.TARGET_DOCUMENT),
                eq(document.getId().toString()), eq(ClinicalAccessAuditService.ACTION_DOWNLOAD),
                eq(ClinicalAccessAuditService.DECISION_DENY));
    }

    @Test
    void doctorListOnlyContainsDocumentsIssuedByThem() {
        UUID foreignSourceId = UUID.fromString("00000000-0000-4000-8000-0000000000e2");
        PatientDocument ownVisit = availableDocument();
        PatientDocument foreignVisit = availableDocument(FOREIGN_DOCUMENT_ID, foreignSourceId);
        MedicalRecord ownRecord = medicalRecord(PATIENT_ID, DOCTOR_ID);
        when(documentRepository.findByPatientIdOrderByGeneratedAtDesc(PATIENT_ID))
                .thenReturn(List.of(ownVisit, foreignVisit));
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of(ownRecord));
        when(prescriptionRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(PATIENT_ID, DOCTOR_ID))
                .thenReturn(List.of());
        stubDoctorRelationship(PATIENT_ID, DOCTOR_ID);

        List<DocumentResponse> visible = service.listDocuments(PATIENT_ID, doctorPrincipal(DOCTOR_ID));

        assertThat(visible).hasSize(1);
        assertThat(visible.get(0).sourceRecordId()).isEqualTo(RECORD_ID);
    }

    // ── Fixtures ────────────────────────────────────────────────────────────
    // Fixtures build their mocks BEFORE entering any when(...) chain so the
    // nested stubbing never runs while an outer stubbing is unfinished.

    private UserDetails patientPrincipal() {
        User user = userMock();
        PatientProfile patient = patientMock(PATIENT_ID);
        when(userRepository.findByEmail("patient@example.com")).thenReturn(Optional.of(user));
        when(patientProfileRepository.findByUserId(USER_ID)).thenReturn(Optional.of(patient));
        return new org.springframework.security.core.userdetails.User(
                "patient@example.com", "password",
                List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));
    }

    private UserDetails doctorPrincipal(UUID doctorUserId) {
        User user = userMock(doctorUserId);
        when(userRepository.findByEmail("doctor@example.com")).thenReturn(Optional.of(user));
        Doctor linkedDoctor = doctorMock(doctorUserId);
        when(doctorRepository.findByUserId(doctorUserId)).thenReturn(Optional.of(linkedDoctor));
        return new org.springframework.security.core.userdetails.User(
                "doctor@example.com", "password",
                List.of(new SimpleGrantedAuthority("ROLE_DOCTOR")));
    }

    private PatientDocument availableDocument() {
        return availableDocument(DOCUMENT_ID, RECORD_ID);
    }

    private PatientDocument availableDocument(UUID documentId, UUID sourceRecordId) {
        PatientDocument document = new PatientDocument();
        document.setId(documentId);
        document.setPatient(patientMock(PATIENT_ID));
        document.setSourceRecordId(sourceRecordId);
        document.setSourceType(DocumentSourceType.VISIT_SUMMARY);
        document.setSourceVersion(SOURCE_VERSION);
        document.setTemplateVersion("1.0");
        document.setStatus(DocumentStatus.AVAILABLE);
        document.setObjectKey("documents/" + PATIENT_ID + "/existing.pdf");
        document.setSha256(codec.sha256Hex(RENDERED_PDF));
        document.setByteSize((long) RENDERED_PDF.length);
        document.setGeneratedBy(userMock());
        document.setIdempotencyKey("VISIT_SUMMARY:" + sourceRecordId + ":" + SOURCE_VERSION + ":1.0");
        return document;
    }

    private MedicalRecord medicalRecord(UUID patientId, UUID doctorId) {
        MedicalRecord record = mock(MedicalRecord.class);
        PatientProfile patient = patientMock(patientId);
        Doctor doctor = doctorMock(doctorId);
        when(record.getId()).thenReturn(RECORD_ID);
        when(record.getPatient()).thenReturn(patient);
        when(record.getDoctor()).thenReturn(doctor);
        when(record.getCreatedAt()).thenReturn(OffsetDateTime.parse("2026-03-01T08:00:00Z"));
        when(record.getUpdatedAt()).thenReturn(OffsetDateTime.parse("2026-03-01T10:00:00Z"));
        when(record.getDiagnosis()).thenReturn("Viêm đường hô hấp trên");
        return record;
    }

    private Prescription prescription(UUID patientId, UUID doctorId, String status) {
        Prescription prescription = mock(Prescription.class);
        PatientProfile patient = patientMock(patientId);
        Doctor doctor = doctorMock(doctorId);
        when(prescription.getId()).thenReturn(RECORD_ID);
        when(prescription.getPatient()).thenReturn(patient);
        when(prescription.getDoctor()).thenReturn(doctor);
        when(prescription.getStatus()).thenReturn(status);
        when(prescription.getUpdatedAt()).thenReturn(OffsetDateTime.parse("2026-03-01T10:00:00Z"));
        when(prescription.getCreatedAt()).thenReturn(OffsetDateTime.parse("2026-03-01T08:00:00Z"));
        return prescription;
    }

    private PatientProfile patientMock(UUID id) {
        PatientProfile patient = mock(PatientProfile.class);
        when(patient.getId()).thenReturn(id);
        when(patient.getFullName()).thenReturn("Nguyễn Thị Bích Hòa");
        when(patient.getPhone()).thenReturn("0901234567");
        when(patient.getUserId()).thenReturn(USER_ID);
        return patient;
    }

    private Doctor doctorMock(UUID id) {
        Doctor doctor = mock(Doctor.class);
        when(doctor.getId()).thenReturn(id);
        when(doctor.getFullName()).thenReturn("BS. Nguyễn Trường Giang");
        return doctor;
    }

    private User userMock() {
        return userMock(USER_ID);
    }

    private User userMock(UUID userId) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        return user;
    }

    private void stubPatientExists(UUID patientId) {
        PatientProfile patient = patientMock(patientId);
        when(patientProfileRepository.findById(patientId)).thenReturn(Optional.of(patient));
    }

    private void stubDoctorRelationship(UUID patientId, UUID doctorId) {
        when(medicalRecordRepository.existsByPatientIdAndDoctorId(patientId, doctorId)).thenReturn(true);
    }

    private PatientDocument assignDocumentId(PatientDocument document) {
        if (document.getId() == null) {
            document.setId(DOCUMENT_ID);
        }
        return document;
    }
}
