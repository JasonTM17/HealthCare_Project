package com.healthcare.document;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.database.IndependentClinicalTransactions;
import com.healthcare.document.service.DocumentObjectCleanupService;
import com.healthcare.document.service.DocumentObjectStore;
import com.healthcare.document.service.DocumentSnapshotCodec;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.zaxxer.hikari.HikariDataSource;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import javax.sql.DataSource;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * F1 regression: generating an APPOINTMENT_REMINDER must survive the real
 * PostgreSQL CHECK constraint on patient_documents.source_type.
 *
 * <p>V71 defined the CHECK inline as {@code ('VISIT_SUMMARY','PRESCRIPTION')}
 * only, so Postgres auto-named it {@code patient_documents_source_type_check}
 * (verified live via pg_constraint) and every APPOINTMENT_REMINDER insert was
 * rejected with a DataIntegrityViolation that the service rethrew as a 500.
 * V109 widens that single constraint; this test drives the public endpoint
 * end-to-end against a disposable database so the whole chain (dispatch ->
 * snapshotFromAppointment -> INSERT -> object store -> AVAILABLE finalization)
 * is exercised, not just the DDL.
 */
@ActiveProfiles("test")
class DocumentGenerationIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private RoleRepository roleRepository;
    @Autowired private DataSource dataSource;
    @Autowired private IndependentClinicalTransactions sideEffects;
    @Autowired private DocumentObjectCleanupService cleanupService;
    @Autowired private PlatformTransactionManager transactionManager;

    @MockitoBean private EmailSender emailSender;
    // Object-store boundary: put() succeeding is what lets the row finalize
    // to AVAILABLE (sha256 + byte_size) without a live MinIO.
    @MockitoBean private DocumentObjectStore objectStore;

    private UUID patientId;
    private UUID appointmentId;
    private String patientBearer;
    private String doctorBearer;

    @BeforeEach
    void fixture() {
        when(emailSender.isDeliveryAvailable()).thenReturn(true);

        User patientUser = user("PATIENT");
        patientBearer = "Bearer " + tokenProvider.generateAccessToken(
                patientUser.getId(), patientUser.getEmail());
        User doctorUser = user("DOCTOR");
        doctorBearer = "Bearer " + tokenProvider.generateAccessToken(
                doctorUser.getId(), doctorUser.getEmail());

        PatientProfile patient = new PatientProfile();
        patient.setUserId(patientUser.getId());
        patient.setFullName("Synthetic reminder patient");
        patient.setPhone("0900000001");
        patient.setEmail(patientUser.getEmail());
        patient = patientProfileRepository.saveAndFlush(patient);
        patientId = patient.getId();

        Specialty specialty = new Specialty();
        specialty.setName("Synthetic specialty");
        specialty.setSlug("synthetic-" + UUID.randomUUID());
        specialty.setActive(true);
        specialty = specialtyRepository.saveAndFlush(specialty);

        Branch branch = new Branch();
        branch.setName("Synthetic branch");
        branch.setSlug("synthetic-" + UUID.randomUUID());
        branch.setAddress("Synthetic fixture only");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);

        Doctor doctor = new Doctor();
        doctor.setFullName("BS. Synthetic Reminder");
        doctor.setSlug("synthetic-" + UUID.randomUUID());
        doctor.setActive(true);
        doctor.setUserId(doctorUser.getId());
        doctor = doctorRepository.saveAndFlush(doctor);

        // appointments has a composite FK (doctor_id, branch_id) -> doctor_branches.
        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
        DoctorSpecialty doctorSpecialty = new DoctorSpecialty();
        doctorSpecialty.setDoctor(doctor);
        doctorSpecialty.setSpecialty(specialty);
        doctorSpecialtyRepository.saveAndFlush(doctorSpecialty);

        Appointment appointment = new Appointment();
        appointment.setBookingCode("REMIN-" + UUID.randomUUID().toString().substring(0, 16));
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setSpecialty(specialty);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.now().plusDays(1));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.of(
                appointment.getAppointmentDate(), appointment.getStartTime(), ZoneOffset.UTC));
        // DocumentService refuses CANCELLED / NO_SHOW sources; pick a live one.
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Synthetic appointment reminder regression");
        appointment = appointmentRepository.saveAndFlush(appointment);
        appointmentId = appointment.getId();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"UTC", "Asia/Ho_Chi_Minh"})
    void appointmentReminderKeepsWallClockTimeOnNonUtcHosts(String hostZone) throws Exception {
        java.util.TimeZone original = java.util.TimeZone.getDefault();
        try {
            java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(hostZone));
            // PostgreSQL TIME is a wall-clock value, not an instant. Write it
            // directly so an ORM round-trip cannot hide a symmetric shift.
            jdbcTemplate.update("UPDATE appointments SET start_time=TIME '09:00', end_time=TIME '09:30' WHERE id=?", appointmentId);
            Appointment stored = appointmentRepository.findById(appointmentId).orElseThrow();
            assertThat(stored.getStartTime()).isEqualTo(LocalTime.of(9, 0));
            assertThat(stored.getEndTime()).isEqualTo(LocalTime.of(9, 30));
            mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                    .header("Authorization", patientBearer)
                    .contentType(MediaType.APPLICATION_JSON).content(requestBody()))
                .andExpect(status().isCreated());
            ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
            verify(objectStore).put(org.mockito.ArgumentMatchers.anyString(), bytes.capture(), eq("application/pdf"));
            try (PDDocument document = Loader.loadPDF(bytes.getValue())) {
                assertThat(new PDFTextStripper().getText(document)).contains("09:00 – 09:30");
            }
            stored.setStartTime(LocalTime.of(10, 0));
            stored.setEndTime(LocalTime.of(10, 30));
            appointmentRepository.saveAndFlush(stored);
            assertThat(jdbcTemplate.queryForObject("SELECT start_time::text FROM appointments WHERE id=?", String.class, appointmentId)).isEqualTo("10:00:00");
            assertThat(jdbcTemplate.queryForObject("SELECT end_time::text FROM appointments WHERE id=?", String.class, appointmentId)).isEqualTo("10:30:00");
        } finally {
            java.util.TimeZone.setDefault(original);
        }
    }

    @Test
    void appointmentReminderGeneratesEndToEndAndFinalizesAvailable() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                // V71 CHECK without APPOINTMENT_REMINDER surfaces here as 500.
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceType").value("APPOINTMENT_REMINDER"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.sourceRecordId").value(appointmentId.toString()))
                .andReturn();

        String documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText();

        // The row really exists in PostgreSQL under the widened CHECK and
        // carries provenance metadata required by the status CHECK.
        var row = jdbcTemplate.queryForMap(
                "SELECT source_type, status, object_key, sha256, byte_size, idempotency_key "
                        + "FROM patient_documents WHERE id = ?", UUID.fromString(documentId));
        assertThat(row.get("source_type")).isEqualTo("APPOINTMENT_REMINDER");
        assertThat(row.get("status")).isEqualTo("AVAILABLE");
        assertThat((String) row.get("object_key")).startsWith("documents/" + patientId + "/");
        assertThat((String) row.get("sha256")).matches("^[0-9a-f]{64}$");
        assertThat(((Number) row.get("byte_size")).longValue()).isGreaterThan(0L);

        // Exactly one put for exactly this key — ADR-005 single-object rule.
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(objectStore, times(1))
                .put(eq((String) row.get("object_key")), bytes.capture(), eq("application/pdf"));
        assertThat(bytes.getValue()).isNotEmpty();
    }

    @Test
    void secondGenerationWithSameKeyReusesTheSingleRow() throws Exception {
        mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));

        // Idempotency ADR-005: the retry returns the winner row, never a
        // second document, and never touches the object store again.
        MvcResult second = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM patient_documents WHERE source_record_id = ?",
                Integer.class, appointmentId);
        assertThat(count).isEqualTo(1);
        Integer keyCount = jdbcTemplate.queryForObject(
                "SELECT count(DISTINCT idempotency_key) FROM patient_documents WHERE source_record_id = ?",
                Integer.class, appointmentId);
        assertThat(keyCount).isEqualTo(1);
        assertThat(objectMapper.readTree(second.getResponse().getContentAsString())
                .get("sourceType").asText()).isEqualTo("APPOINTMENT_REMINDER");
        verify(objectStore, times(1)).put(any(String.class), any(byte[].class), any(String.class));
    }

    @Test
    void concurrentSameSourceGenerationReusesOneRowAndObject() throws Exception {
        CountDownLatch firstPutEntered = new CountDownLatch(1);
        CountDownLatch releaseFirstPut = new CountDownLatch(1);
        doAnswer(invocation -> {
            firstPutEntered.countDown();
            assertThat(releaseFirstPut.await(10, TimeUnit.SECONDS)).isTrue();
            return null;
        }).when(objectStore).put(any(String.class), any(byte[].class), any(String.class));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<MvcResult> generate = () -> mockMvc.perform(
                            post("/api/v1/patients/{patientId}/documents", patientId)
                                    .header("Authorization", patientBearer)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(requestBody()))
                    .andReturn();
            Future<MvcResult> first = executor.submit(generate);
            assertThat(firstPutEntered.await(10, TimeUnit.SECONDS)).isTrue();
            Future<MvcResult> second = executor.submit(generate);

            boolean lockWaitObserved = false;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline && !lockWaitObserved) {
                Boolean waiting = jdbcTemplate.queryForObject(
                        "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()"
                                + " AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'"
                                + " AND (query ILIKE '%patient_documents%'"
                                + " OR query ILIKE '%pg_advisory_xact_lock%'))",
                        Boolean.class);
                lockWaitObserved = Boolean.TRUE.equals(waiting);
                if (!lockWaitObserved) {
                    Thread.sleep(25);
                }
            }
            assertThat(lockWaitObserved).isTrue();

            releaseFirstPut.countDown();
            MvcResult firstResult = first.get(15, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(15, TimeUnit.SECONDS);
            assertThat(firstResult.getResponse().getStatus()).isEqualTo(201);
            assertThat(secondResult.getResponse().getStatus()).isEqualTo(201);
            String firstId = objectMapper.readTree(firstResult.getResponse().getContentAsString())
                    .get("id").asText();
            String secondId = objectMapper.readTree(secondResult.getResponse().getContentAsString())
                    .get("id").asText();
            assertThat(secondId).isEqualTo(firstId);
            assertThat(objectMapper.readTree(firstResult.getResponse().getContentAsString())
                    .get("status").asText()).isEqualTo("AVAILABLE");
            assertThat(objectMapper.readTree(secondResult.getResponse().getContentAsString())
                    .get("status").asText()).isEqualTo("AVAILABLE");
            verify(objectStore, times(1)).put(any(String.class), any(byte[].class), any(String.class));
            Integer rows = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM patient_documents WHERE source_record_id = ?",
                    Integer.class, appointmentId);
            assertThat(rows).isEqualTo(1);
        } finally {
            releaseFirstPut.countDown();
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    @Test
    void assignedDoctorCanListAndDownloadTheirGeneratedAppointmentReminder() throws Exception {
        Map<String, byte[]> stored = stubObjectStoreRoundTrip();

        MvcResult created = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", doctorBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();
        String documentId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        MvcResult list = mockMvc.perform(get("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", doctorBearer))
                .andReturn();
        int listStatus = list.getResponse().getStatus();
        String listBody = list.getResponse().getContentAsString();
        MvcResult download = mockMvc.perform(get(
                        "/api/v1/patients/{patientId}/documents/{documentId}/download",
                        patientId, documentId)
                        .header("Authorization", doctorBearer))
                .andReturn();
        int downloadStatus = download.getResponse().getStatus();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(listStatus).as("doctor list status").isEqualTo(200);
        softly.assertThat(listBody).as("doctor list includes generated id").contains(documentId);
        byte[] expected = stored.values().iterator().next();
        byte[] actual = download.getResponse().getContentAsByteArray();
        DocumentSnapshotCodec codec = new DocumentSnapshotCodec();
        softly.assertThat(downloadStatus).as("doctor download status").isEqualTo(200);
        softly.assertThat(download.getResponse().getContentType())
                .as("download content type").startsWith("application/pdf");
        softly.assertThat(actual.length).as("downloaded length equals stored object length")
                .isEqualTo(expected.length);
        softly.assertThat(codec.sha256Hex(actual)).as("downloaded sha256 equals stored object sha256")
                .isEqualTo(codec.sha256Hex(expected));
        softly.assertThat(new String(actual, 0, Math.min(5, actual.length), StandardCharsets.US_ASCII))
                .as("downloaded payload is a PDF").isEqualTo("%PDF-");
        softly.assertAll();
    }

    @Test
    void unrelatedDoctorCannotListOrDownloadAnotherPatientsAppointmentReminder() throws Exception {
        stubObjectStoreRoundTrip();

        MvcResult created = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andReturn();
        String documentId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        User strangerUser = user("DOCTOR");
        Doctor stranger = new Doctor();
        stranger.setFullName("BS. Unrelated");
        stranger.setSlug("unrelated-" + UUID.randomUUID());
        stranger.setActive(true);
        stranger.setUserId(strangerUser.getId());
        doctorRepository.saveAndFlush(stranger);
        String strangerBearer = "Bearer " + tokenProvider.generateAccessToken(
                strangerUser.getId(), strangerUser.getEmail());

        mockMvc.perform(get("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", strangerBearer))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/patients/{patientId}/documents/{documentId}/download",
                        patientId, documentId)
                        .header("Authorization", strangerBearer))
                .andExpect(status().isForbidden());
    }

    @Test
    void concurrentPoolSizedGenerationDoesNotStarveIndependentSideEffects() throws Exception {
        HikariDataSource hikari = dataSource.unwrap(HikariDataSource.class);
        assertThat(hikari.getMaximumPoolSize()).isEqualTo(3);
        String jdbcUrl = hikari.getJdbcUrl();
        assertThat(jdbcUrl).matches(
                "jdbc:postgresql://(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?/healthcare_test(\\?.*)?");

        CountDownLatch firstPutEntered = new CountDownLatch(1);
        CountDownLatch releaseFirstPut = new CountDownLatch(1);
        doAnswer(invocation -> {
            firstPutEntered.countDown();
            assertThat(releaseFirstPut.await(10, TimeUnit.SECONDS)).isTrue();
            return null;
        }).when(objectStore).put(any(String.class), any(byte[].class), any(String.class));

        ExecutorService executor = Executors.newFixedThreadPool(3);
        try (Connection probe = DriverManager.getConnection(
                        jdbcUrl, hikari.getUsername(), hikari.getPassword());
             Statement statement = probe.createStatement()) {
            statement.setQueryTimeout(2);
            Callable<MvcResult> generate = () -> mockMvc.perform(
                            post("/api/v1/patients/{patientId}/documents", patientId)
                                    .header("Authorization", patientBearer)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(requestBody()))
                    .andReturn();
            Future<MvcResult> first = executor.submit(generate);
            Future<MvcResult> second = executor.submit(generate);
            Future<MvcResult> third = executor.submit(generate);
            assertThat(firstPutEntered.await(10, TimeUnit.SECONDS)).isTrue();

            int waiting = 0;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline && waiting < 2) {
                try (ResultSet rs = statement.executeQuery(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
                                + " AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'"
                                + " AND query ILIKE '%pg_advisory_xact_lock%'")) {
                    rs.next();
                    waiting = rs.getInt(1);
                }
                if (waiting < 2) {
                    Thread.sleep(25);
                }
            }
            assertThat(waiting)
                    .as("advisory-lock waiters while the 3-connection pool is saturated")
                    .isGreaterThanOrEqualTo(2);

            releaseFirstPut.countDown();
            MvcResult firstResult = first.get(30, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(30, TimeUnit.SECONDS);
            MvcResult thirdResult = third.get(30, TimeUnit.SECONDS);
            SoftAssertions softly = new SoftAssertions();
            String firstId = null;
            for (MvcResult result : new MvcResult[]{firstResult, secondResult, thirdResult}) {
                var json = objectMapper.readTree(result.getResponse().getContentAsString());
                softly.assertThat(result.getResponse().getStatus()).isEqualTo(201);
                softly.assertThat(json.get("status").asText()).isEqualTo("AVAILABLE");
                if (firstId == null) {
                    firstId = json.get("id").asText();
                } else {
                    softly.assertThat(json.get("id").asText()).isEqualTo(firstId);
                }
            }
            softly.assertAll();
            verify(objectStore, times(1))
                    .put(any(String.class), any(byte[].class), any(String.class));
            Integer rows = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM patient_documents WHERE source_record_id = ?",
                    Integer.class, appointmentId);
            assertThat(rows).isEqualTo(1);
        } finally {
            releaseFirstPut.countDown();
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    @Test
    void independentSideEffectPoolWritesToTheSameDisposableDatabase() {
        AtomicReference<String> name = new AtomicReference<>();
        sideEffects.write(jdbc -> name.set(
                jdbc.queryForObject("SELECT current_database()", String.class)));
        assertThat(name.get())
                .isEqualTo(jdbcTemplate.queryForObject(
                        "SELECT current_database()", String.class))
                .isEqualTo("healthcare_test");
    }

    @Test
    void cleanupMarkerSurvivesPrimaryTransactionRollback() {
        String objectKey = "documents/test/rollback-marker.pdf";
        TransactionTemplate primary = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> primary.executeWithoutResult(status -> {
            cleanupService.trackCandidate(objectKey);
            throw new RuntimeException("forced primary rollback");
        })).hasMessageContaining("forced primary rollback");

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM patient_document_object_cleanup"
                        + " WHERE object_key = ?",
                Integer.class, objectKey))
                .isEqualTo(1);
    }

    @Test
    void generationAfterAppointmentRescheduleProducesUpdatedReminder() throws Exception {
        MvcResult first = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();
        var firstJson = objectMapper.readTree(first.getResponse().getContentAsString());
        String firstId = firstJson.get("id").asText();
        long firstVersion = firstJson.get("sourceVersion").asLong();

        Appointment appointment = appointmentRepository.findById(appointmentId).orElseThrow();
        LocalDate newDate = appointment.getAppointmentDate().plusDays(7);
        LocalTime newStart = LocalTime.of(14, 0);
        LocalTime newEnd = LocalTime.of(14, 30);
        appointment.setAppointmentDate(newDate);
        appointment.setStartTime(newStart);
        appointment.setEndTime(newEnd);
        appointment.setAppointmentTime(OffsetDateTime.of(newDate, newStart, ZoneOffset.UTC));
        appointmentRepository.saveAndFlush(appointment);

        MvcResult staleAvailableDownload = mockMvc.perform(get(
                        "/api/v1/patients/{patientId}/documents/{documentId}/download",
                        patientId, firstId)
                        .header("Authorization", patientBearer))
                .andReturn();
        MvcResult beforeRegen = mockMvc.perform(get("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(staleAvailableDownload.getResponse().getStatus())
                .as("stale AVAILABLE reminder download is rejected before any object read")
                .isEqualTo(409);
        var staleRow = findRow(beforeRegen, firstId);
        assertThat(staleRow.get("status").asText()).isEqualTo("AVAILABLE");
        assertThat(staleRow.get("sourceCurrent").asBoolean()).isFalse();
        assertThat(staleRow.get("sourceEligible").asBoolean()).isTrue();
        verify(objectStore, never()).get(any(String.class));

        MvcResult second = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();
        var secondJson = objectMapper.readTree(second.getResponse().getContentAsString());
        String secondId = secondJson.get("id").asText();

        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(objectStore, times(2))
                .put(any(String.class), bytes.capture(), eq("application/pdf"));

        MvcResult supersededDownload = mockMvc.perform(get(
                        "/api/v1/patients/{patientId}/documents/{documentId}/download",
                        patientId, firstId)
                        .header("Authorization", patientBearer))
                .andReturn();
        MvcResult list = mockMvc.perform(get("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer))
                .andExpect(status().isOk())
                .andReturn();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(secondId)
                .as("rescheduling produces a new document row")
                .isNotEqualTo(firstId);
        softly.assertThat(secondJson.get("sourceVersion").asLong())
                .as("rescheduling bumps sourceVersion")
                .isNotEqualTo(firstVersion);
        try (PDDocument document = Loader.loadPDF(bytes.getAllValues().get(1))) {
            String text = new PDFTextStripper().getText(document);
            softly.assertThat(text)
                    .as("regenerated reminder carries the rescheduled date")
                    .contains(newDate.toString());
            softly.assertThat(text)
                    .as("regenerated reminder carries the rescheduled time")
                    .contains(newStart + " – " + newEnd);
        }
        softly.assertThat(supersededDownload.getResponse().getStatus())
                .as("superseded reminder keeps the persisted-status contract")
                .isEqualTo(403);
        var oldRow = findRow(list, firstId);
        var newRow = findRow(list, secondId);
        softly.assertThat(oldRow).as("old reminder still listed").isNotNull();
        softly.assertThat(oldRow.get("status").asText())
                .as("superseded row keeps its persisted status")
                .isEqualTo("SUPERSEDED");
        softly.assertThat(oldRow.get("sourceCurrent").asBoolean())
                .as("old reminder no longer matches the live appointment")
                .isFalse();
        softly.assertThat(oldRow.get("sourceEligible").asBoolean())
                .as("rescheduled appointment is still an eligible source")
                .isTrue();
        softly.assertThat(newRow.get("sourceCurrent").asBoolean())
                .as("new reminder matches the live appointment")
                .isTrue();
        var keys = jdbcTemplate.queryForList(
                "SELECT idempotency_key FROM patient_documents"
                        + " WHERE source_record_id = ? ORDER BY generated_at, id",
                String.class, appointmentId);
        softly.assertThat(keys).hasSize(2);
        softly.assertThat(keys.get(1)).isNotEqualTo(keys.get(0));
        softly.assertThat(keys.get(1))
                .as("reminder identity carries the full content digest")
                .matches("APPOINTMENT_REMINDER:" + appointmentId + ":[0-9a-f]{64}:.*");
        softly.assertAll();
        verify(objectStore, never()).get(any(String.class));
    }

    private com.fasterxml.jackson.databind.JsonNode findRow(MvcResult list, String documentId)
            throws Exception {
        for (var row : objectMapper.readTree(list.getResponse().getContentAsString())) {
            if (documentId.equals(row.get("id").asText())) {
                return row;
            }
        }
        return null;
    }

    @Test
    void cancelledAppointmentReminderCannotBeDownloaded() throws Exception {
        stubObjectStoreRoundTrip();

        MvcResult created = mockMvc.perform(post("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn();
        String documentId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        Appointment appointment = appointmentRepository.findById(appointmentId).orElseThrow();
        String bookingCode = appointment.getBookingCode();
        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.saveAndFlush(appointment);

        MvcResult byId = mockMvc.perform(get(
                        "/api/v1/patients/{patientId}/documents/{documentId}/download",
                        patientId, documentId)
                        .header("Authorization", patientBearer))
                .andReturn();
        MvcResult byBooking = mockMvc.perform(get(
                        "/api/v1/patients/{patientId}/documents/by-booking/{bookingCode}/download",
                        patientId, bookingCode)
                        .header("Authorization", patientBearer))
                .andReturn();
        MvcResult list = mockMvc.perform(get("/api/v1/patients/{patientId}/documents", patientId)
                        .header("Authorization", patientBearer))
                .andExpect(status().isOk())
                .andReturn();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(byId.getResponse().getStatus())
                .as("cancelled reminder download by id")
                .isEqualTo(409);
        softly.assertThat(byBooking.getResponse().getStatus())
                .as("cancelled reminder download by booking code")
                .isEqualTo(409);
        var row = findRow(list, documentId);
        softly.assertThat(row).as("cancelled reminder still listed").isNotNull();
        softly.assertThat(row.get("sourceCurrent").asBoolean())
                .as("cancelled source is never current")
                .isFalse();
        softly.assertThat(row.get("sourceEligible").asBoolean())
                .as("cancelled source is not eligible")
                .isFalse();
        softly.assertAll();
        verify(objectStore, never()).get(any(String.class));
    }

    private Map<String, byte[]> stubObjectStoreRoundTrip() throws Exception {
        Map<String, byte[]> stored = new ConcurrentHashMap<>();
        doAnswer(invocation -> {
            stored.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(objectStore).put(any(String.class), any(byte[].class), any(String.class));
        when(objectStore.isConfigured()).thenReturn(true);
        when(objectStore.get(any(String.class))).thenAnswer(invocation -> {
            byte[] bytes = stored.get(invocation.getArgument(0));
            return bytes == null ? null : new ByteArrayInputStream(bytes);
        });
        return stored;
    }

    private String requestBody() {
        return """
                {"sourceType":"APPOINTMENT_REMINDER","sourceRecordId":"%s"}
                """.formatted(appointmentId);
    }

    private User user(String roleCode) {
        var role = roleRepository.findByCode(roleCode).orElseThrow();
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setPasswordHash("unused-synthetic-test-hash");
        user.setDisplayName("Synthetic " + roleCode);
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);
        jdbcTemplate.update("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", user.getId(), role.getId());
        return user;
    }
}
