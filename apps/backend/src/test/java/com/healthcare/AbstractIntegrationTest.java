package com.healthcare;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.repository.DiagnosticResultRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.repository.CmsContentRepository;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
        registry.add("spring.flyway.url", () -> dbUrl);
        registry.add("spring.flyway.user", () -> dbUsername);
        registry.add("spring.flyway.password", () -> dbPassword);
        // Safe test-only secret — not a real credential, never committed as a real value
        registry.add("app.jwt.secret",
                () -> "test-secret-key-healthcare-project-must-be-32chars");
    }

    @Autowired
    protected MockMvc mockMvc;

    // ── Auth domain ───────────────────────────────────────────────────────────
    @Autowired protected UserRepository userRepository;
    @Autowired protected RefreshTokenRepository refreshTokenRepository;

    // ── Hospital & Appointment domain ────────────────────────────────────────
    @Autowired protected SpecialtyRepository specialtyRepository;
    @Autowired protected CmsContentChangeRepository cmsContentChangeRepository;
    @Autowired protected CmsContentRepository cmsContentRepository;
    @Autowired protected DoctorRepository doctorRepository;
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

    // ── Clinical overlay ─────────────────────────────────────────────────────
    @Autowired protected DiagnosticResultRepository diagnosticResultRepository;
    @Autowired protected MedicalRecordRepository medicalRecordRepository;
    @Autowired protected PrescriptionRepository prescriptionRepository;

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
        // CMS public change rows reference CMS content and must be cleared first.
        cmsContentChangeRepository.deleteAll();
        cmsContentRepository.deleteAll();

        // Clinical domain (children before patient/doctor/appointment parents)
        prescriptionRepository.deleteAll();
        medicalRecordRepository.deleteAll();
        diagnosticResultRepository.deleteAll();

        // Appointment domain (FK dependencies on hospital & patient)
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
        doctorRepository.deleteAll();   // doctor_specialties & doctor_branches cascade
        branchRepository.deleteAll();
        specialtyRepository.deleteAll();

        // Auth domain (refresh_tokens FK on users)
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }
}
