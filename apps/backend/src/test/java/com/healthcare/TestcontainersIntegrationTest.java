package com.healthcare;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Testcontainers-backed variant of {@link AbstractIntegrationTest}.
 *
 * <p>Spins up a shared PostgreSQL 16 Testcontainer — started once per JVM run via
 * {@code @Container} on a static field, then reused across all subclasses. Use this
 * base when an isolated, production-identical database is required (e.g. CI with
 * Docker available). Requires a reachable Docker daemon; on environments without
 * Docker, extend {@link AbstractIntegrationTest} instead.
 *
 * <p>All integration test classes must extend either this class or
 * {@link AbstractIntegrationTest}. Do NOT duplicate {@code @SpringBootTest},
 * {@code @AutoConfigureMockMvc} or {@code @Testcontainers} on subclasses.
 */
@Testcontainers
public abstract class TestcontainersIntegrationTest extends AbstractIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("healthcare_test")
            .withUsername("healthcare_test")
            .withPassword("healthcare_test")
            .withReuse(true);

    @DynamicPropertySource
    static void configureTestcontainersDataSource(DynamicPropertyRegistry registry) {
        // Override the local-DB properties from AbstractIntegrationTest.
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
    }
}
