package com.healthcare.user;

import com.healthcare.database.CatalogFixtureCallback;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminPasswordMigrationIntegrationTest {
    private static final List<String> OLD_ACTIONS = List.of("READ", "DOWNLOAD", "PRESCRIBE", "ADMIN_CANCEL_APPOINTMENT",
        "GENERATE", "REVOKE", "ADMIN_UPDATE_USER_STATUS", "ADMIN_UPDATE_USER_ROLES");

    @Test
    void actualSeededV122UpgradePreservesAllDataHistoryAndExistingAuditActions() throws Exception {
        String name = "admin_password_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        assertThat(name).matches("admin_password_upgrade_[0-9a-f]{32}");
        // This fixture never reads TEST_DB_* or inherits a Spring application datasource.
        try (PostgreSQLContainer<?> owned = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName(name).withUsername("healthcare_test").withPassword("healthcare_test")
            .withLabel("healthcare.test.fixture", "admin-password-upgrade")) {
            owned.start();
            DataSource source = new DriverManagerDataSource(owned.getJdbcUrl(), owned.getUsername(), owned.getPassword());
            JdbcTemplate db = new JdbcTemplate(source);
            assertThat(db.queryForObject("select current_database()", String.class)).isEqualTo(name);
            assertThat(db.queryForObject("select current_user", String.class)).isEqualTo("healthcare_test");
            assertThat(db.queryForObject("select count(*) from information_schema.tables where table_schema='public'", Integer.class)).isZero();
            Flyway baseline = migration(source, "122");
            baseline.migrate();
            assertThat(baseline.info().current().getVersion().getVersion()).isEqualTo("122");
            assertThat(db.queryForObject("select count(*) from flyway_schema_history where version='123'", Integer.class)).isZero();
            for (String action : OLD_ACTIONS) audit(db, action);
            assertThatThrownBy(() -> audit(db, "ADMIN_UPDATE_USER_PASSWORD")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            Map<String, String> data = fingerprints(db);
            List<String> history = db.queryForList("select to_jsonb(h)::text from flyway_schema_history h order by installed_rank", String.class);
            assertThat(db.queryForObject("select count(*) from clinical_access_audit", Integer.class)).isEqualTo(OLD_ACTIONS.size());
            Flyway upgrade = migration(source, "123");
            assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(1);
            assertThat(upgrade.info().current().getVersion().getVersion()).isEqualTo("123");
            assertThat(fingerprints(db)).isEqualTo(data);
            assertThat(db.queryForList("select to_jsonb(h)::text from flyway_schema_history h where version<>'123' or version is null order by installed_rank", String.class)).isEqualTo(history);
            assertThat(db.queryForObject("select count(*) from flyway_schema_history where version='123' and success", Integer.class)).isEqualTo(1);
            for (String action : OLD_ACTIONS) audit(db, action);
            audit(db, "ADMIN_UPDATE_USER_PASSWORD");
            assertThatThrownBy(() -> audit(db, "UNKNOWN_FIXTURE_ACTION")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        }
    }

    private static Flyway migration(DataSource source, String target) {
        return Flyway.configure().dataSource(source).locations("classpath:db/migration").schemas("public").defaultSchema("public")
            .callbacks(new CatalogFixtureCallback()).target(org.flywaydb.core.api.MigrationVersion.fromVersion(target)).load();
    }

    private static void audit(JdbcTemplate db, String action) {
        db.update("insert into clinical_access_audit(id,actor_user_id,actor_email,actor_role,target_type,target_id,action,decision) values(?,?,?,'ADMIN','USER',?,?,'ALLOW')",
            UUID.randomUUID(), UUID.randomUUID(), "upgrade-fixture@example.invalid", UUID.randomUUID().toString(), action);
    }

    private static Map<String, String> fingerprints(JdbcTemplate db) throws Exception {
        Map<String, String> result = new TreeMap<>();
        List<String> tables = db.queryForList("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'flyway_schema_history' order by table_name", String.class);
        for (String table : tables) {
            String identifier = "\"" + table.replace("\"", "\"\"") + "\"";
            List<String> rows = db.queryForList("select to_jsonb(t)::text from public." + identifier + " t order by to_jsonb(t)::text collate \"C\"", String.class);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String row : rows) {
                byte[] bytes = row.getBytes(StandardCharsets.UTF_8);
                digest.update((bytes.length + ":").getBytes(StandardCharsets.US_ASCII)); digest.update(bytes);
            }
            result.put(table, rows.size() + ":" + HexFormat.of().formatHex(digest.digest()));
        }
        return result;
    }
}
