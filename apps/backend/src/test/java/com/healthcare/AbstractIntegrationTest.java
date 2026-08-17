package com.healthcare;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base class for all Spring Boot integration tests.
 *
 * <p>Spins up a shared PostgreSQL 16 Testcontainer — started once per JVM run via
 * {@code @Container} on a static field, then reused across all subclasses. This means
 * Flyway migrations run exactly once and Postgres behaves identically to production.
 *
 * <p>Each test method gets a clean database state via {@link #cleanDatabase()} which
 * deletes all user-generated data (hospital domain + auth) while leaving Flyway-seeded
 * reference data (roles) intact.
 *
 * <p>All integration test classes must extend this class. Do NOT duplicate
 * {@code @SpringBootTest}, {@code @AutoConfigureMockMvc} or {@code @Testcontainers}
 * on subclasses.
 */
@SpringBootTest(classes = HealthCareBackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers
public abstract class AbstractIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("healthcare_test")
            .withUsername("healthcare_test")
            .withPassword("healthcare_test")
            .withReuse(true);

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
        // Safe test-only secret — not a real credential, never committed as a real value
        registry.add("app.jwt.secret",
                () -> "test-secret-key-healthcare-project-must-be-32chars");
    }

    @Autowired
    protected MockMvc mockMvc;

    // ── Auth domain ───────────────────────────────────────────────────────────
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;

    // ── Hospital & Appointment domain ────────────────────────────────────────
    @Autowired protected SpecialtyRepository specialtyRepository;
    @Autowired protected DoctorRepository doctorRepository;
    @Autowired protected BranchRepository branchRepository;
    @Autowired protected PackageRepository packageRepository;
    @Autowired protected ArticleRepository articleRepository;
    @Autowired protected FaqRepository faqRepository;
    @Autowired protected ServiceRepository serviceRepository;
    @Autowired protected AppointmentRepository appointmentRepository;
    @Autowired protected DoctorScheduleRepository doctorScheduleRepository;
    @Autowired protected PatientProfileRepository patientProfileRepository;

    /**
     * Wipe all user-generated rows before every test so tests are fully independent.
     * Deletion order respects FK constraints (children before parents).
     * Flyway-seeded data (roles, permissions) is intentionally left intact.
     */
    @BeforeEach
    void cleanDatabase() {
        // Appointment domain (FK dependencies on hospital & patient)
        appointmentRepository.deleteAll();
        doctorScheduleRepository.deleteAll();
        patientProfileRepository.deleteAll();

        // Hospital domain
        articleRepository.deleteAll();
        faqRepository.deleteAll();
        packageRepository.deleteAll();
        serviceRepository.deleteAll();
        doctorRepository.deleteAll();   // doctor_specialties & doctor_branches cascade
        branchRepository.deleteAll();
        specialtyRepository.deleteAll();

        // Auth domain (refresh_tokens FK on users)
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }
}
