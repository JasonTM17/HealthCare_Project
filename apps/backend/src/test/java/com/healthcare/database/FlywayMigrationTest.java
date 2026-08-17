package com.healthcare.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import com.healthcare.TestcontainersIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
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
    void branchAwareSchedulingConstraintsAreMigrated() {
        List<String> constraints = jdbcTemplate.queryForList(
            "select constraint_name from information_schema.table_constraints "
                + "where table_schema = 'public' and constraint_name in "
                + "('fk_doctor_schedules_doctor_branch', 'fk_schedule_exceptions_doctor_branch', "
                + "'fk_appointments_doctor_branch', 'ck_schedule_exception_custom_range')",
            String.class
        );

        assertThat(constraints).containsExactlyInAnyOrder(
            "fk_doctor_schedules_doctor_branch",
            "fk_schedule_exceptions_doctor_branch",
            "fk_appointments_doctor_branch",
            "ck_schedule_exception_custom_range"
        );
    }

    @Test
    void scheduleCannotBypassDoctorBranchAssignmentAtDatabaseBoundary() {
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();

        jdbcTemplate.update(
            "insert into doctors (id, full_name, slug, active) values (?, ?, ?, true)",
            doctorId, "Migration test doctor", "migration-test-doctor-" + doctorId
        );
        jdbcTemplate.update(
            "insert into branches (id, name, slug, address, active) values (?, ?, ?, ?, true)",
            branchId, "Migration test branch", "migration-test-branch-" + branchId, "Test address"
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
            "insert into doctor_schedules "
                + "(id, doctor_id, branch_id, day_of_week, start_time, end_time, "
                + "slot_duration_minutes, effective_from, active) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?, true)",
            UUID.randomUUID(), doctorId, branchId, 1,
            LocalTime.of(9, 0), LocalTime.of(10, 0), 30,
            LocalDate.now().plusDays(1)
        )).isInstanceOf(DataAccessException.class);
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
