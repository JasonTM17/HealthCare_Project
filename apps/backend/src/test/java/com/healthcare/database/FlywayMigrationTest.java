package com.healthcare.database;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import com.healthcare.TestcontainersIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class FlywayMigrationTest extends TestcontainersIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void identityRbacTablesAreMigrated() {
        // PostgreSQL information_schema uses lowercase table names
        List<String> tables = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public'",
            String.class
        );

        assertThat(tables).contains(
            "users", "roles", "permissions",
            "user_roles", "role_permissions", "refresh_tokens"
        );
    }

    @Test
    void hospitalDomainTablesAreMigrated() {
        List<String> tables = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public'",
            String.class
        );

        assertThat(tables).contains(
            "specialties", "doctors", "branches",
            "services", "packages", "articles", "faqs",
            "doctor_specialties", "doctor_branches"
        );
    }

    @Test
    void appointmentDomainTablesAreMigrated() {
        List<String> tables = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public'",
            String.class
        );

        assertThat(tables).contains(
            "doctor_schedules", "patient_profiles", "appointments"
        );
    }

    @Test
    void clinicalOverlayTablesAndProfileLinksAreMigrated() {
        List<String> tables = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public'",
            String.class
        );

        assertThat(tables).contains(
            "medical_records", "prescriptions", "prescription_items", "diagnostic_results"
        );

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from information_schema.columns where table_schema = 'public' "
                + "and table_name in ('doctors', 'patient_profiles') and column_name = 'user_id'",
            Integer.class
        )).isEqualTo(2);
    }

    @Test
    void defaultRolesAreSeeded() {
        List<String> roles = jdbcTemplate.queryForList(
            "select code from roles order by code",
            String.class
        );

        assertThat(roles).containsExactly("ADMIN", "DOCTOR", "PATIENT");
    }
}
