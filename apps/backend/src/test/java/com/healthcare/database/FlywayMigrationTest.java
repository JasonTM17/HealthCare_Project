package com.healthcare.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import com.healthcare.TestcontainersIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import javax.sql.DataSource;

class FlywayMigrationTest extends TestcontainersIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DataSource dataSource;

    @AfterEach
    void resetSharedDataSourceSearchPath() {
        // Flyway and the seed-script fixture intentionally switch a pooled
        // connection to a temporary schema. Restore the application schema
        // before AbstractIntegrationTest cleans the next test's rows.
        jdbcTemplate.execute("set search_path to public");
    }

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
    void v10PreflightDiagnosesUnassignedLegacyBranchRowsBeforeAddingForeignKeys() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "9");
            UUID doctorId = UUID.randomUUID();
            UUID branchId = UUID.randomUUID();
            String doctors = table(schema, "doctors");
            String branches = table(schema, "branches");
            String schedules = table(schema, "doctor_schedules");

            jdbcTemplate.update(
                "insert into " + doctors + " (id, full_name, slug, active) values (?, ?, ?, true)",
                doctorId, "Legacy migration doctor", "legacy-migration-doctor-" + doctorId
            );
            jdbcTemplate.update(
                "insert into " + branches + " (id, name, slug, address, active) values (?, ?, ?, ?, true)",
                branchId, "Legacy migration branch", "legacy-migration-branch-" + branchId, "Test address"
            );
            jdbcTemplate.update(
                "insert into " + schedules
                    + " (id, doctor_id, branch_id, day_of_week, start_time, end_time, "
                    + "slot_duration_minutes, effective_from, active) values (?, ?, ?, ?, ?, ?, ?, ?, true)",
                UUID.randomUUID(), doctorId, branchId, 1,
                LocalTime.of(9, 0), LocalTime.of(10, 0), 30,
                LocalDate.now().plusDays(1)
            );

            Throwable failure = catchThrowable(() -> migrate(schema, "10"));
            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains(
                "V10 preflight failed",
                "schedule rows",
                "Repair or explicitly reassign",
                "never deletes production data"
            );
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v8PreservesOldestLivePendingHoldAndCancelsLaterDuplicates() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "7");
            UUID doctorId = UUID.randomUUID();
            UUID patientId = UUID.randomUUID();
            UUID canonicalId = UUID.randomUUID();
            UUID duplicateId = UUID.randomUUID();
            LocalDate appointmentDate = LocalDate.now().plusDays(2);
            LocalTime startTime = LocalTime.of(9, 0);
            OffsetDateTime now = OffsetDateTime.now();
            String doctors = table(schema, "doctors");
            String patients = table(schema, "patient_profiles");
            String appointments = table(schema, "appointments");

            jdbcTemplate.update(
                "insert into " + doctors + " (id, full_name, slug, active) values (?, ?, ?, true)",
                doctorId, "Duplicate hold doctor", "duplicate-hold-doctor-" + doctorId
            );
            jdbcTemplate.update(
                "insert into " + patients + " (id, full_name, phone) values (?, ?, ?)",
                patientId, "Duplicate hold patient", "090" + Math.abs(patientId.hashCode())
            );
            insertPendingAppointment(
                appointments, canonicalId, canonicalId.toString().replace("-", ""),
                doctorId, patientId, appointmentDate, startTime,
                now.plusMinutes(10), now.minusMinutes(2)
            );
            insertPendingAppointment(
                appointments, duplicateId, duplicateId.toString().replace("-", ""),
                doctorId, patientId, appointmentDate, startTime,
                now.plusMinutes(10), now.minusMinutes(1)
            );

            migrate(schema, "8");

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments + " where status = 'PENDING_CONFIRMATION'",
                Integer.class
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select id from " + appointments + " where status = 'PENDING_CONFIRMATION'",
                UUID.class
            )).isEqualTo(canonicalId);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments
                    + " where id = ? and status = 'CANCELLED' and cancellation_reason = ?",
                Integer.class,
                duplicateId,
                "Hủy giữ chỗ trùng khi nâng cấp dữ liệu (giữ bản ghi tạo sớm nhất)"
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from pg_indexes where schemaname = ? and indexname = ?",
                Integer.class,
                schema,
                "uq_appointments_active_slot"
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void localSeedSchedulesFollowDoctorBranchAssignments() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "10");
            executeSeed(schema);
            String schedules = table(schema, "doctor_schedules");
            String doctors = table(schema, "doctors");
            String branches = table(schema, "branches");
            String doctorBranches = table(schema, "doctor_branches");

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + schedules,
                Integer.class
            )).isEqualTo(30);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + schedules + " s "
                    + "left join " + doctorBranches + " db "
                    + "on db.doctor_id = s.doctor_id and db.branch_id = s.branch_id "
                    + "where db.doctor_id is null",
                Integer.class
            )).isZero();
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + schedules + " s "
                    + "join " + doctors + " d on d.id = s.doctor_id "
                    + "join " + branches + " b on b.id = s.branch_id "
                    + "where d.slug in ('le-van-duc', 'pham-hoang-yen') "
                    + "and b.slug = 'phong-kham-thao-dien'",
                Integer.class
            )).isEqualTo(10);
        } finally {
            dropMigrationSchema(schema);
        }
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

    private void insertPendingAppointment(
            String appointments,
            UUID id,
            String bookingCode,
            UUID doctorId,
            UUID patientId,
            LocalDate appointmentDate,
            LocalTime startTime,
            OffsetDateTime holdExpiresAt,
            OffsetDateTime createdAt) {
        jdbcTemplate.update(
            "insert into " + appointments
                + " (id, booking_code, patient_id, doctor_id, appointment_date, start_time, "
                + "appointment_time, status, hold_expires_at, created_at) "
                + "values (?, ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRMATION', ?, ?)",
            id, bookingCode, patientId, doctorId, appointmentDate, startTime,
            appointmentDate.atTime(startTime).atOffset(createdAt.getOffset()), holdExpiresAt, createdAt
        );
    }

    private String createMigrationSchema() {
        String schema = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbcTemplate.execute("create schema " + identifier(schema));
        return schema;
    }

    private void migrate(String schema, String target) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .schemas(schema)
            .defaultSchema(schema)
            .target(MigrationVersion.fromVersion(target))
            .load()
            .migrate();
    }

    private void executeSeed(String schema) {
        try (Connection connection = dataSource.getConnection()) {
            connection.createStatement().execute("set search_path to " + identifier(schema));
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(
                    new ClassPathResource("db/seed/seed-local-data.sql"),
                    StandardCharsets.UTF_8
                )
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to execute local seed in isolated migration schema", exception);
        }
    }

    private void dropMigrationSchema(String schema) {
        jdbcTemplate.execute("drop schema if exists " + identifier(schema) + " cascade");
    }

    private String table(String schema, String table) {
        return identifier(schema) + "." + identifier(table);
    }

    private String identifier(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String allMessages(Throwable failure) {
        StringBuilder messages = new StringBuilder();
        Throwable current = failure;
        while (current != null) {
            if (current.getMessage() != null) {
                messages.append(current.getMessage()).append('\n');
            }
            current = current.getCause();
        }
        return messages.toString();
    }
}
