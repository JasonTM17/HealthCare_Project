package com.healthcare;

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

import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;

/**
 * Base class for all Spring Boot integration tests.
 *
 * <p>Spins up a shared PostgreSQL 16 Testcontainer — started once per JVM run via
 * {@code @Container} on a static field, then reused across all subclasses. This means
 * Flyway migrations run exactly once and Postgres behaves identically to production.
 *
 * <p>Each test method gets a clean database state via {@link #cleanDatabase()} which
 * truncates user-generated data while leaving seeded reference data (roles) intact.
 *
 * <p>All integration test classes must extend this class. Do NOT duplicate
 * {@code @SpringBootTest} or {@code @Testcontainers} on subclasses.
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
        // Use a deterministic test secret — not a real credential
        registry.add("app.jwt.secret",
                () -> "test-secret-key-healthcare-project-must-be-32chars");
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    /**
     * Wipe user-generated rows before every test so tests are fully independent.
     * Reference data (roles, permissions) seeded by Flyway is left intact.
     */
    @BeforeEach
    void cleanDatabase() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }
}
