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

/**
 * Base class for all Spring Boot integration tests.
 *
 * <p>By default this base points the test datasource at the local PostgreSQL
 * instance (the docker-compose service on {@code localhost:5434/healthcare}), so
 * the suite runs without Testcontainers and without a Docker daemon. This keeps
 * the build hermetic on developer machines and CI agents where Docker is absent.
 *
 * <p>The connection is overridable via environment variables, so the same tests
 * can target any Postgres without code changes:
 * <ul>
 *   <li>{@code TEST_DB_URL} — JDBC URL (default {@code jdbc:postgresql://localhost:5434/healthcare})</li>
 *   <li>{@code TEST_DB_USERNAME} — default {@code healthcare}</li>
 *   <li>{@code TEST_DB_PASSWORD} — default {@code change-me}</li>
 *   <li>{@code TEST_DB_NAME} — default {@code healthcare}</li>
 * </ul>
 *
 * <p>For an isolated, production-identical Postgres (incl. CI with Docker),
 * extend {@link TestcontainersIntegrationTest} instead, which spins up a shared
 * PostgreSQL 16 container.
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

    private static final String DEFAULT_DB_URL = "jdbc:postgresql://localhost:5434/healthcare";
    private static final String DEFAULT_DB_USERNAME = "healthcare";
    private static final String DEFAULT_DB_PASSWORD = "change-me";

    private static final String dbUrl = System.getenv().getOrDefault("TEST_DB_URL", DEFAULT_DB_URL);
    private static final String dbUsername = System.getenv().getOrDefault("TEST_DB_USERNAME", DEFAULT_DB_USERNAME);
    private static final String dbPassword = System.getenv().getOrDefault("TEST_DB_PASSWORD", DEFAULT_DB_PASSWORD);

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
