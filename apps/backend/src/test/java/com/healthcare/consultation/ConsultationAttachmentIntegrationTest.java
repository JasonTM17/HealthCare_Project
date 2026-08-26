package com.healthcare.consultation;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.ConsultationAttachmentScanWorker;
import com.healthcare.consultation.service.PatientConsultationService;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@TestPropertySource(properties = "storage.consultation.enabled=true")
class ConsultationAttachmentIntegrationTest extends AbstractIntegrationTest {
    @Autowired private PatientConsultationService consultations;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private RoleRepository roles;
    @MockitoBean private ConsultationAttachmentStorage storage;

    private ConsultationAttachmentScanWorker worker;
    private HealthcareUserPrincipal patient;
    private UUID thread;
    private UUID attachment;
    private String uploadKey;

    @BeforeEach
    void fixture() {
        worker = new ConsultationAttachmentScanWorker(jdbcTemplate, storage, transactionManager, true, 30);
        when(storage.isEnabled()).thenReturn(true);
        User owner = user("PATIENT");
        patient = HealthcareUserPrincipal.from(owner);
        User doctorUser = user("DOCTOR");
        Doctor doctor = new Doctor();
        doctor.setFullName("Synthetic doctor");
        doctor.setSlug("synthetic-" + UUID.randomUUID());
        doctor.setUserId(doctorUser.getId());
        doctor.setActive(true);
        doctor = doctorRepository.saveAndFlush(doctor);
        Branch branch = new Branch();
        branch.setName("Synthetic branch");
        branch.setSlug("synthetic-" + UUID.randomUUID());
        branch.setAddress("Synthetic fixture only");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);
        DoctorBranch assignment = new DoctorBranch();
        assignment.setDoctor(doctor);
        assignment.setBranch(branch);
        doctorBranchRepository.saveAndFlush(assignment);
        PatientProfile profile = new PatientProfile();
        profile.setUserId(owner.getId());
        profile.setFullName("Synthetic patient");
        profile.setPhone("0900000000");
        profile.setEmail(owner.getEmail());
        profile = patientProfileRepository.saveAndFlush(profile);
        Appointment appointment = new Appointment();
        appointment.setBookingCode("SCAN-" + UUID.randomUUID().toString().substring(0, 16));
        appointment.setPatient(profile);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.now().plusDays(1));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.of(appointment.getAppointmentDate(), appointment.getStartTime(), ZoneOffset.UTC));
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Synthetic attachment test");
        appointment.setOtpCode("unused-test-hash");
        appointment.setOtpExpiresAt(OffsetDateTime.now().plusMinutes(5));
        appointment = appointmentRepository.saveAndFlush(appointment);
        thread = consultations.create(new ConsultationContracts.CreateRequest(appointment.getId(),
            "Synthetic consultation", true, "consultation-v1"), patient).id();
        UUID message = consultations.send(thread, new ConsultationContracts.MessageRequest("Synthetic text"),
            UUID.randomUUID().toString(), patient).id();
        attachment = UUID.randomUUID();
        uploadKey = "private/consultations/" + thread + "/upload/" + attachment;
        String verifiedKey = "private/consultations/" + thread + "/verified/" + attachment;
        when(storage.createUploadIntent(any())).thenReturn(new ConsultationAttachmentStorage.UploadIntent(
            ConsultationAttachmentStorage.Availability.ENABLED, attachment, uploadKey, verifiedKey,
            URI.create("https://objects.example.test/synthetic"), Instant.now().plusSeconds(300), "PENDING", null));
        consultations.attachmentIntent(thread, new ConsultationContracts.AttachmentIntentRequest(
            message, "image/jpeg", 5L, "a".repeat(64)), patient);
        when(storage.isUploadPresent(any())).thenReturn(true);
        when(storage.scanWithLease(any(), any())).thenAnswer(call -> clean(call.getArgument(0)));
    }

    @Test
    void browserCompletionOnlyHeadsAndQueueSurvivesUntilIndependentWorkerRuns() {
        var pending = complete();
        assertThat(pending.scanStatus()).isEqualTo("PENDING");
        assertThat(pending.uploadStatus()).isEqualTo("UPLOADED");
        assertThat(pending.downloadUrl()).isNull();
        verify(storage).isUploadPresent(any());
        verify(storage, never()).complete(any());
        verify(storage, never()).scanWithLease(any(), any());
        assertThatThrownBy(() -> consultations.downloadIntent(thread, attachment, patient))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class);
        worker.scanOne();
        var clean = consultations.attachmentStatus(thread, attachment, patient);
        assertThat(clean.scanStatus()).isEqualTo("CLEAN");
        assertThat(clean.downloadUrl()).isNull();
        assertThat(jdbcTemplate.queryForObject("select private_object_key from patient_consultation_attachments where id=?",
            String.class, attachment)).isNotEqualTo(uploadKey).contains("verified");
        complete(); // Idempotent browser retry cannot rescan/overwrite CLEAN.
        verify(storage, times(1)).scanWithLease(any(), any());
        assertThat(eventCount("CLEAN")).isEqualTo(1);
    }

    @Test
    void scannerOutageRetriesWithoutDownloadAndWithoutLosingUploadedState() {
        complete();
        doThrow(new IllegalStateException("synthetic unavailable"))
            .when(storage).scanWithLease(any(), any());
        worker.scanOne();
        assertThat(consultations.attachmentStatus(thread, attachment, patient).scanStatus()).isEqualTo("PENDING");
        assertThat(consultations.attachmentStatus(thread, attachment, patient).uploadStatus()).isEqualTo("UPLOADED");
        assertThat(jdbcTemplate.queryForObject("select scanned_at is null and scan_lease_token is null from patient_consultation_attachments where id=?",
            Boolean.class, attachment)).isTrue();
        jdbcTemplate.update("update patient_consultation_attachments set scan_available_at=CURRENT_TIMESTAMP where id=?", attachment);
        doAnswer(call -> clean(call.getArgument(0))).when(storage).scanWithLease(any(), any());
        worker.scanOne();
        assertThat(consultations.attachmentStatus(thread, attachment, patient).scanStatus()).isEqualTo("CLEAN");
    }

    @Test
    void expiredWorkerCannotOverwriteNewerMalwareVerdict() throws Exception {
        complete();
        CountDownLatch scanning = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        doAnswer(call -> {
            var request = call.getArgument(0, ConsultationAttachmentStorage.CompletionRequest.class);
            if (calls.getAndIncrement() == 0) {
                scanning.countDown();
                if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("test barrier timed out");
                return clean(request);
            }
            return ConsultationAttachmentStorage.CompletionResult.rejected(attachment, uploadKey,
                "image/jpeg", 5, "a".repeat(64), "ATTACHMENT_REJECTED_BY_SCANNER");
        }).when(storage).scanWithLease(any(), any());
        var executor = Executors.newSingleThreadExecutor();
        try {
            var delayed = executor.submit(worker::scanOne);
            assertThat(scanning.await(10, TimeUnit.SECONDS)).isTrue();
            worker.scanOne(); // A current lease cannot be acquired twice.
            assertThat(calls.get()).isEqualTo(1);
            jdbcTemplate.update("update patient_consultation_attachments set scan_lease_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' where id=?", attachment);
            worker.scanOne();
            assertThat(calls.get()).isEqualTo(2);
            release.countDown();
            delayed.get(10, TimeUnit.SECONDS);
            assertThat(consultations.attachmentStatus(thread, attachment, patient).scanStatus()).isEqualTo("REJECTED");
            assertThat(eventCount("CLEAN")).isZero();
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void finalAttemptCrashIsReapedAndUnacknowledgedUploadIsNeverScanned() {
        worker.scanOne();
        verify(storage, never()).scanWithLease(any(), any());
        complete();
        jdbcTemplate.update("""
            update patient_consultation_attachments set scan_attempts=8, scan_lease_token=?,
                scan_lease_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' where id=?
            """, UUID.randomUUID(), attachment);
        worker.scanOne();
        assertThat(consultations.attachmentStatus(thread, attachment, patient).scanStatus()).isEqualTo("REJECTED");
        assertThat(eventCount("REJECTED")).isEqualTo(1);
        verify(storage, never()).scanWithLease(any(), any());
    }

    @Test
    void scanCanFinishAfterAcknowledgedUploadIntentExpires() {
        complete();
        jdbcTemplate.update("""
            update patient_consultation_attachments set upload_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second',
                uploaded_at=CURRENT_TIMESTAMP-INTERVAL '2 seconds' where id=?
            """, attachment);
        assertThat(complete().scanStatus()).isEqualTo("PENDING");
        worker.scanOne();
        assertThat(consultations.attachmentStatus(thread, attachment, patient).scanStatus()).isEqualTo("CLEAN");
    }

    @Test
    void anotherPatientCannotAcknowledgePollOrDownloadAttachment() {
        var other = HealthcareUserPrincipal.from(user("PATIENT"));
        assertThatThrownBy(() -> consultations.completeAttachment(thread, attachment,
            new ConsultationContracts.AttachmentCompleteRequest(true), other))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class);
        assertThatThrownBy(() -> consultations.attachmentStatus(thread, attachment, other))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class);
        assertThatThrownBy(() -> consultations.downloadIntent(thread, attachment, other))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class);
        verify(storage, never()).isUploadPresent(any());
    }

    private ConsultationContracts.Attachment complete() {
        return consultations.completeAttachment(thread, attachment,
            new ConsultationContracts.AttachmentCompleteRequest(true), patient);
    }

    private ConsultationAttachmentStorage.CompletionResult clean(ConsultationAttachmentStorage.CompletionRequest request) {
        return new ConsultationAttachmentStorage.CompletionResult(ConsultationAttachmentStorage.Availability.ENABLED,
            request.attachmentId(), request.expectedVerifiedObjectKey() != null
                ? request.expectedVerifiedObjectKey()
                : "private/consultations/" + request.threadId() + "/verified/" + UUID.randomUUID(),
            request.expectedMimeType(), request.expectedSizeBytes(), request.expectedSha256(),
            ConsultationAttachmentStorage.ScanStatus.CLEAN, Instant.now(), null);
    }

    private int eventCount(String state) {
        return jdbcTemplate.queryForObject("select count(*) from patient_consultation_events where thread_id=? and metadata->>'status'=?",
            Integer.class, thread, state);
    }

    private User user(String role) {
        var persistedRole = roles.findByCode(role).orElseThrow();
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setPasswordHash("unused-synthetic-test-hash");
        user.setDisplayName("Synthetic " + role);
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);
        jdbcTemplate.update("insert into user_roles(user_id, role_id) values (?, ?)", user.getId(), persistedRole.getId());
        // The returned instance is used only to build an in-process principal;
        // DB role authority is the join row above. Do not merge the detached role.
        user.addRole(persistedRole);
        return user;
    }
}
