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
            "doctor_specialties", "doctor_branches",
            "cms_contents", "cms_content_changes",
            "job_positions", "job_applications"
        );
    }

    @Test
    void localSeedIsFictionalAndIdempotentOnPostgres() {
        executeSeed("public");
        executeSeed("public");

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from cms_contents where slot_key = 'homepage.hero'",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select payload ->> 'title' from cms_contents where slot_key = 'homepage.hero'",
            String.class
        )).isEqualTo("Đồng hành cùng sức khỏe gia đình");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from cms_contents where payload::text ilike '%patient%'",
            Integer.class
        )).isZero();
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
    void v11ScopesActiveSlotAndIntervalConstraintsByBranchAndNormalizesNull() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "10");
            UUID doctorId = UUID.randomUUID();
            UUID patientId = UUID.randomUUID();
            UUID branchAId = UUID.randomUUID();
            UUID branchBId = UUID.randomUUID();
            String doctors = table(schema, "doctors");
            String branches = table(schema, "branches");
            String doctorBranches = table(schema, "doctor_branches");
            String patients = table(schema, "patient_profiles");
            String appointments = table(schema, "appointments");

            jdbcTemplate.update(
                "insert into " + doctors + " (id, full_name, slug, active) values (?, ?, ?, true)",
                doctorId, "Branch constraint doctor", "branch-constraint-doctor-" + doctorId
            );
            jdbcTemplate.update(
                "insert into " + branches + " (id, name, slug, address, active) values (?, ?, ?, ?, true)",
                branchAId, "Branch A", "branch-a-" + branchAId, "Test address A"
            );
            jdbcTemplate.update(
                "insert into " + branches + " (id, name, slug, address, active) values (?, ?, ?, ?, true)",
                branchBId, "Branch B", "branch-b-" + branchBId, "Test address B"
            );
            jdbcTemplate.update(
                "insert into " + doctorBranches + " (id, doctor_id, branch_id) values (?, ?, ?)",
                UUID.randomUUID(), doctorId, branchAId
            );
            jdbcTemplate.update(
                "insert into " + doctorBranches + " (id, doctor_id, branch_id) values (?, ?, ?)",
                UUID.randomUUID(), doctorId, branchBId
            );
            jdbcTemplate.update(
                "insert into " + patients + " (id, full_name, phone) values (?, ?, ?)",
                patientId, "Branch constraint patient", "090" + Math.abs(patientId.hashCode())
            );

            migrate(schema, "11");
            LocalDate appointmentDate = LocalDate.now().plusDays(4);
            OffsetDateTime holdExpiry = OffsetDateTime.now().plusMinutes(10);

            // Exact active slots may coexist at different assigned branches.
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchAId,
                appointmentDate, LocalTime.of(9, 0), LocalTime.of(10, 0),
                "CONFIRMED", null
            );
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchBId,
                appointmentDate, LocalTime.of(9, 0), LocalTime.of(10, 0),
                "PENDING_CONFIRMATION", holdExpiry
            );
            assertThatThrownBy(() -> insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchAId,
                appointmentDate, LocalTime.of(9, 0), LocalTime.of(10, 0),
                "PENDING_CONFIRMATION", holdExpiry
            )).isInstanceOf(DataAccessException.class);

            // Interval overlap is branch-scoped too: branch B succeeds while
            // the same overlapping interval at branch A is rejected.
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchAId,
                appointmentDate, LocalTime.of(13, 0), LocalTime.of(14, 0),
                "CONFIRMED", null
            );
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchBId,
                appointmentDate, LocalTime.of(13, 30), LocalTime.of(14, 30),
                "PENDING_CONFIRMATION", holdExpiry
            );
            assertThatThrownBy(() -> insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchAId,
                appointmentDate, LocalTime.of(13, 30), LocalTime.of(14, 30),
                "PENDING_CONFIRMATION", holdExpiry
            )).isInstanceOf(DataAccessException.class);

            // NULL is a real legacy branchless scope, not an unconstrained key.
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, null,
                appointmentDate, LocalTime.of(15, 0), LocalTime.of(15, 30),
                "CONFIRMED", null
            );
            insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, branchAId,
                appointmentDate, LocalTime.of(15, 0), LocalTime.of(15, 30),
                "PENDING_CONFIRMATION", holdExpiry
            );
            assertThatThrownBy(() -> insertAppointment(
                appointments, UUID.randomUUID(), doctorId, patientId, null,
                appointmentDate, LocalTime.of(15, 0), LocalTime.of(15, 30),
                "PENDING_CONFIRMATION", holdExpiry
            )).isInstanceOf(DataAccessException.class);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v10_5RepairsPendingOverlapBeforeV11CreatesConstraints() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "10");
            UUID doctorId = UUID.randomUUID();
            UUID patientId = UUID.randomUUID();
            UUID canonicalId = UUID.randomUUID();
            UUID duplicateId = UUID.randomUUID();
            LocalDate appointmentDate = LocalDate.now().plusDays(3);
            String doctors = table(schema, "doctors");
            String patients = table(schema, "patient_profiles");
            String appointments = table(schema, "appointments");

            jdbcTemplate.update(
                "insert into " + doctors + " (id, full_name, slug, active) values (?, ?, ?, true)",
                doctorId, "Pre-V11 repair doctor", "pre-v11-repair-doctor-" + doctorId
            );
            jdbcTemplate.update(
                "insert into " + patients + " (id, full_name, phone) values (?, ?, ?)",
                patientId, "Pre-V11 repair patient", "090" + Math.abs(patientId.hashCode())
            );
            jdbcTemplate.execute("drop index " + identifier(schema) + ".uq_appointments_active_slot");
            jdbcTemplate.execute(
                "alter table " + identifier(schema) + ".appointments "
                    + "drop constraint if exists ex_appointments_active_interval"
            );
            insertAppointment(
                appointments, canonicalId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(9, 0), LocalTime.of(10, 0),
                "PENDING_CONFIRMATION", OffsetDateTime.now().plusMinutes(10)
            );
            insertAppointment(
                appointments, duplicateId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(9, 30), LocalTime.of(10, 30),
                "PENDING_CONFIRMATION", OffsetDateTime.now().plusMinutes(10)
            );

            migrate(schema, "10.4");
            migrate(schema, "10.5");

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
                "Hủy giữ chỗ trùng khi nâng cấp dữ liệu trước V11"
            )).isEqualTo(1);

            migrate(schema, "11");
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
    void v10_4FailsBeforeMutatingWhenReservedBranchlessKeyIsOccupied() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "10");
            String branches = table(schema, "branches");
            jdbcTemplate.update(
                "insert into " + branches + " (id, name, slug, address, active) values (?, ?, ?, ?, true)",
                UUID.fromString("00000000-0000-0000-0000-000000000000"),
                "Reserved key collision",
                "reserved-key-collision-" + UUID.randomUUID(),
                "Test address"
            );

            Throwable failure = catchThrowable(() -> migrate(schema, "10.4"));
            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains(
                "V10.4 preflight failed",
                "reserved zero UUID",
                "never deletes booking data"
            );
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v10_5CancelsExpiredAndPendingConflictsBeforeSelectingLiveHold() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "10");
            UUID doctorId = UUID.randomUUID();
            UUID patientId = UUID.randomUUID();
            UUID expiredId = UUID.randomUUID();
            UUID liveId = UUID.randomUUID();
            UUID confirmedId = UUID.randomUUID();
            UUID blockedPendingId = UUID.randomUUID();
            LocalDate appointmentDate = LocalDate.now().plusDays(5);
            String doctors = table(schema, "doctors");
            String patients = table(schema, "patient_profiles");
            String appointments = table(schema, "appointments");

            jdbcTemplate.update(
                "insert into " + doctors + " (id, full_name, slug, active) values (?, ?, ?, true)",
                doctorId, "Pre-V11 policy doctor", "pre-v11-policy-doctor-" + doctorId
            );
            jdbcTemplate.update(
                "insert into " + patients + " (id, full_name, phone) values (?, ?, ?)",
                patientId, "Pre-V11 policy patient", "090" + Math.abs(patientId.hashCode())
            );
            jdbcTemplate.execute("drop index " + identifier(schema) + ".uq_appointments_active_slot");
            jdbcTemplate.execute(
                "alter table " + identifier(schema) + ".appointments "
                    + "drop constraint if exists ex_appointments_active_interval"
            );
            insertAppointment(
                appointments, expiredId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(9, 0), LocalTime.of(10, 0),
                "PENDING_CONFIRMATION", OffsetDateTime.now().minusMinutes(1)
            );
            insertAppointment(
                appointments, liveId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(9, 30), LocalTime.of(10, 30),
                "PENDING_CONFIRMATION", OffsetDateTime.now().plusMinutes(10)
            );
            insertAppointment(
                appointments, confirmedId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(11, 0), LocalTime.of(12, 0),
                "CONFIRMED", null
            );
            insertAppointment(
                appointments, blockedPendingId, doctorId, patientId, null,
                appointmentDate, LocalTime.of(11, 30), LocalTime.of(12, 30),
                "PENDING_CONFIRMATION", OffsetDateTime.now().plusMinutes(10)
            );

            migrate(schema, "10.4");
            migrate(schema, "10.5");

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments
                    + " where id = ? and status = 'CANCELLED' and cancellation_reason = ?",
                Integer.class,
                expiredId,
                "Hết thời gian giữ chỗ (Quá 10 phút)"
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments + " where id = ? and status = 'PENDING_CONFIRMATION'",
                Integer.class,
                liveId
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments + " where id = ? and status = 'CONFIRMED'",
                Integer.class,
                confirmedId
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + appointments
                    + " where id = ? and status = 'CANCELLED' and cancellation_reason = ?",
                Integer.class,
                blockedPendingId,
                "Hủy giữ chỗ trùng khi nâng cấp dữ liệu trước V11"
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v13PreservesOldestLivePendingHoldAndCancelsLaterDuplicates() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "12");
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
            jdbcTemplate.execute("drop index " + identifier(schema) + ".uq_appointments_active_slot");
            jdbcTemplate.execute(
                "alter table " + identifier(schema) + ".appointments "
                    + "drop constraint if exists ex_appointments_active_interval"
            );
            insertAppointment(
                appointments, canonicalId, doctorId, patientId, null,
                appointmentDate, startTime, startTime.plusHours(1),
                "PENDING_CONFIRMATION", now.plusMinutes(10)
            );
            insertAppointment(
                appointments, duplicateId, doctorId, patientId, null,
                appointmentDate, startTime, startTime.plusHours(1),
                "PENDING_CONFIRMATION", now.plusMinutes(10)
            );

            migrate(schema, "13");

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
            migrate(schema, "19");
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

    private void insertAppointment(
            String appointments,
            UUID id,
            UUID doctorId,
            UUID patientId,
            UUID branchId,
            LocalDate appointmentDate,
            LocalTime startTime,
            LocalTime endTime,
            String status,
            OffsetDateTime holdExpiresAt) {
        jdbcTemplate.update(
            "insert into " + appointments
                + " (id, booking_code, patient_id, doctor_id, branch_id, appointment_date, "
                + "start_time, end_time, appointment_time, status, hold_expires_at) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, id.toString().replace("-", ""), patientId, doctorId, branchId,
            appointmentDate, startTime, endTime,
            appointmentDate.atTime(startTime).atOffset(java.time.ZoneOffset.UTC),
            status, holdExpiresAt
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
