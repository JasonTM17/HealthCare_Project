package com.healthcare;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.ai.chat.repository.AiConversationRepository;
import com.healthcare.ai.chat.repository.AiMessageRepository;
import com.healthcare.clinical.repository.DiagnosticResultRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.career.repository.JobApplicationRepository;
import com.healthcare.career.repository.JobPositionRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.repository.CmsContentRepository;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.storage.repository.StoredFileRepository;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.appointment.repository.AppointmentAccountClaimRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base class for all Spring Boot integration tests.
 *
 * <p>By default this base starts a disposable PostgreSQL 16 Testcontainer. This
 * keeps Flyway, PostgreSQL advisory locks, and exclusion constraints under test
 * without touching a developer's application database.
 *
 * <p>An explicitly supplied {@code TEST_DB_URL} can still target an external
 * PostgreSQL instance. That override is intended for a dedicated throwaway test
 * database because each test method cleans its rows. It must be paired with
 * {@code TEST_DB_ALLOW_CLEANUP=true}; without that explicit guard the suite
 * refuses to start rather than risking deletion from an application database.
 *
 * <p>The external connection is overridable via environment variables:
 * <ul>
 *   <li>{@code TEST_DB_URL} — external JDBC URL (otherwise a disposable container is used)</li>
 *   <li>{@code TEST_DB_USERNAME} — default {@code healthcare}</li>
 *   <li>{@code TEST_DB_PASSWORD} — default {@code change-me}</li>
 *   <li>{@code TEST_DB_ALLOW_CLEANUP} — must be {@code true} for external URLs</li>
 * </ul>
 *
 * <p>Each test method gets a clean database state via {@link #cleanDatabase()} which
 * deletes all user-generated data (hospital domain + auth + appointments) while
 * leaving Flyway-seeded reference data (roles, permissions) intact.
 *
 * <p>All integration test classes must extend either this class or
 * {@link TestcontainersIntegrationTest}. Do NOT duplicate {@code @SpringBootTest}
 * or {@code @AutoConfigureMockMvc} on subclasses.
 */
@SpringBootTest(classes = HealthCareBackendApplication.class)
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    private static final String externalDbUrl = System.getenv("TEST_DB_URL");
    private static final boolean useExternalDatabase = externalDbUrl != null && !externalDbUrl.isBlank();
    private static final boolean allowExternalCleanup = "true".equalsIgnoreCase(
        System.getenv("TEST_DB_ALLOW_CLEANUP")
    );
    private static final PostgreSQLContainer<?> testDatabase = createTestDatabase();
    private static final String dbUrl = useExternalDatabase ? externalDbUrl : testDatabase.getJdbcUrl();
    private static final String dbUsername = useExternalDatabase
        ? System.getenv().getOrDefault("TEST_DB_USERNAME", "healthcare")
        : testDatabase.getUsername();
    private static final String dbPassword = useExternalDatabase
        ? System.getenv().getOrDefault("TEST_DB_PASSWORD", "change-me")
        : testDatabase.getPassword();

    private static PostgreSQLContainer<?> createTestDatabase() {
        if (useExternalDatabase) {
            if (!allowExternalCleanup) {
                throw new IllegalStateException(
                    "Refusing destructive integration-test cleanup for TEST_DB_URL. "
                        + "Use a dedicated test database and set TEST_DB_ALLOW_CLEANUP=true explicitly."
                );
            }
            return null;
        }
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("healthcare_test")
            .withUsername("healthcare_test")
            .withPassword("healthcare_test");
        container.start();
        return container;
    }

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.datasource.url", () -> dbUrl);
        registry.add("spring.datasource.username", () -> dbUsername);
        registry.add("spring.datasource.password", () -> dbPassword);
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "3");
        registry.add("spring.datasource.hikari.minimum-idle", () -> "1");
        registry.add("spring.flyway.url", () -> dbUrl);
        registry.add("spring.flyway.user", () -> dbUsername);
        registry.add("spring.flyway.password", () -> dbPassword);
        // Safe test-only secret — not a real credential, never committed as a real value
        registry.add("app.jwt.secret",
                () -> "test-secret-key-healthcare-project-must-be-32chars");
        registry.add("app.security.rate-limit.enabled", () -> "false");
        registry.add("app.payment.bank-transfer.webhook-secret",
                () -> "test-only-payment-webhook-secret-at-least-32-chars");
        // Deterministic test-only AES key; never reused outside disposable
        // Testcontainers databases and never populated from a real secret.
        registry.add("app.mail.outbox.encryption-key",
                () -> "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    }

    @Autowired
    protected MockMvc mockMvc;
    @Autowired
    protected JdbcTemplate jdbcTemplate;

    // ── Auth domain ───────────────────────────────────────────────────────────
    @Autowired protected UserRepository userRepository;
    @Autowired protected RefreshTokenRepository refreshTokenRepository;
    @Autowired protected AiConversationRepository aiConversationRepository;
    @Autowired protected AiMessageRepository aiMessageRepository;

    // ── Hospital & Appointment domain ────────────────────────────────────────
    @Autowired protected SpecialtyRepository specialtyRepository;
    @Autowired protected CmsContentChangeRepository cmsContentChangeRepository;
    @Autowired protected CmsContentRepository cmsContentRepository;
    @Autowired protected DoctorRepository doctorRepository;
    @Autowired protected DoctorSpecialtyRepository doctorSpecialtyRepository;
    @Autowired protected BranchRepository branchRepository;
    @Autowired protected DoctorBranchRepository doctorBranchRepository;
    @Autowired protected PackageRepository packageRepository;
    @Autowired protected ArticleRepository articleRepository;
    @Autowired protected FaqRepository faqRepository;
    @Autowired protected ServiceRepository serviceRepository;
    @Autowired protected AppointmentRepository appointmentRepository;
    @Autowired protected DoctorScheduleRepository doctorScheduleRepository;
    @Autowired protected DoctorScheduleExceptionRepository doctorScheduleExceptionRepository;
    @Autowired protected PatientProfileRepository patientProfileRepository;
    @Autowired protected BankTransferPaymentRepository bankTransferPaymentRepository;
    @Autowired protected AppointmentAccountClaimRepository appointmentAccountClaimRepository;

    // ── Clinical overlay ─────────────────────────────────────────────────────
    @Autowired protected DiagnosticResultRepository diagnosticResultRepository;
    @Autowired protected MedicalRecordRepository medicalRecordRepository;
    @Autowired protected PrescriptionRepository prescriptionRepository;
    @Autowired protected StoredFileRepository storedFileRepository;
    @Autowired protected JobApplicationRepository jobApplicationRepository;
    @Autowired protected JobPositionRepository jobPositionRepository;

    /**
     * Wipe all user-generated rows before every test so tests are fully independent.
     * Deletion order respects FK constraints (children before parents).
     * Flyway-seeded data (roles, permissions) is intentionally left intact.
     *
     * <p>Clinical rows are deleted first when the overlay is present so the same
     * base remains safe for foundation and clinical integration tests.
     */
    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("""
            TRUNCATE TABLE patient_consultation_object_cleanup,
                           email_outbox,
                           notification_preferences
            """);
        // Keep this cleanup lock compatible with the REQUIRES_NEW audit writer
        // exercised by @Transactional integration tests. PostgreSQL TRUNCATE
        // holds AccessExclusiveLock until the test transaction ends, which
        // would otherwise deadlock the audit INSERT on its new connection.
        jdbcTemplate.execute("DELETE FROM clinical_access_audit");
        // Consultation/Q&A/care-plan rows were added after the original test
        // baseline.  Truncate the complete child set together so append-only
        // audit and answer triggers cannot leak state between tests.  This is
        // disposable Testcontainers data only; production retention uses the
        // bounded service and never TRUNCATEs patient content.
        jdbcTemplate.execute("""
            TRUNCATE TABLE patient_consultation_events,
                           patient_consultation_attachments,
                           patient_consultation_read_states,
                           patient_consultation_messages,
                           patient_consultation_participants,
                           patient_consultation_threads,
                           health_question_reports,
                           health_question_answers,
                           health_questions,
                           patient_care_plan_items,
                           patient_care_plans,
                           faqs
            """);

        // Governed AI rows point at users and immutable catalog revisions. They
        // must be removed before the catalog/auth rows below; otherwise a test
        // that exercises the revision/outbox transaction would make the next
        // test's cleanup fail on the intentional RESTRICT foreign keys.
        // TRUNCATE is intentional here: the production tables are append-only
        // by trigger, while this base owns a disposable Testcontainers schema.
        // It removes only the five governance/outbox tables and does not
        // cascade into catalog or user tables that reference them.
        jdbcTemplate.execute("""
            TRUNCATE TABLE ai_content_review_events,
                           ai_content_approval_rounds,
                           ai_content_review_heads,
                           ai_content_revisions,
                           sync_outbox_events
            """);

        // CMS public change rows reference CMS content and must be cleared first.
        cmsContentChangeRepository.deleteAll();
        cmsContentRepository.deleteAll();

        // Clinical domain (children before patient/doctor/appointment parents)
        prescriptionRepository.deleteAll();
        medicalRecordRepository.deleteAll();
        diagnosticResultRepository.deleteAll();
        storedFileRepository.deleteAll();

        // Recruitment applications contain candidate data and reference openings.
        jobApplicationRepository.deleteAll();
        jobPositionRepository.deleteAll();

        // Appointment domain (FK dependencies on hospital & patient)
        appointmentAccountClaimRepository.deleteAll();
        bankTransferPaymentRepository.deleteAll();
        appointmentRepository.deleteAll();
        doctorScheduleExceptionRepository.deleteAll();
        doctorScheduleRepository.deleteAll();
        patientProfileRepository.deleteAll();

        // Hospital domain
        articleRepository.deleteAll();
        faqRepository.deleteAll();
        packageRepository.deleteAll();
        serviceRepository.deleteAll();
        doctorBranchRepository.deleteAll();
        doctorSpecialtyRepository.deleteAll();
        doctorRepository.deleteAll();
        branchRepository.deleteAll();
        specialtyRepository.deleteAll();

        // Auth domain (refresh_tokens FK on users)
        // Bulk delete avoids Hibernate nulling the self-referencing assistant
        // request link before removal, which would violate the message-shape constraint.
        aiMessageRepository.deleteAllInBatch();
        aiConversationRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }
}
