package com.healthcare.cms;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.database.CatalogFixtureCallback;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CmsSnapshotMigrationIntegrationTest extends AbstractIntegrationTest {
    @Autowired private DataSource dataSource;

    @Test
    void v116UpgradeBackfillsOnlyPublicSnapshotAndEnforcesDraftEpochAndNullMetadataContracts() throws Exception {
        String ownedSchema = "cms_snapshot_test_" + UUID.randomUUID().toString().replace("-", "");
        assertThat(ownedSchema).matches("cms_snapshot_test_[0-9a-f]{32}");
        UUID published = UUID.randomUUID();
        UUID legacyDraft = UUID.randomUUID();
        UUID user = UUID.randomUUID();
        OffsetDateTime timestamp = OffsetDateTime.parse("2026-01-02T03:04:05.123456Z");
        try {
            migrate(ownedSchema, "116");
            try (Connection connection = dataSource.getConnection()) {
                connection.setSchema(ownedSchema);
                try {
                    connection.createStatement().execute("delete from cms_content_changes");
                    connection.createStatement().execute("delete from cms_contents");
                    insert(connection, published, "about.body", "NOTICE", "PUBLISHED", 7, timestamp);
                    insert(connection, legacyDraft, "contact.body", "NOTICE", "DRAFT", 3, timestamp);
                    try (PreparedStatement sql = connection.prepareStatement("insert into users(id,email,password_hash,display_name,status) values (?,?,'test-hash','Upgrade user','ACTIVE')")) {
                        sql.setObject(1, user); sql.setString(2, "upgrade-" + user + "@healthcare.local"); sql.executeUpdate();
                    }
                } finally { connection.setSchema("public"); }
            }
            migrate(ownedSchema, "118");
            try (Connection connection = dataSource.getConnection()) {
                connection.setSchema(ownedSchema);
                try {
                    try (PreparedStatement sql = connection.prepareStatement("select payload->>'title',version,public_revision,public_updated_at,draft_component_type,draft_payload,draft_updated_at,status from cms_contents where id=?")) {
                        sql.setObject(1, published);
                        try (var result = sql.executeQuery()) {
                            assertThat(result.next()).isTrue();
                            assertThat(result.getString(1)).isEqualTo("Retained legacy payload");
                            assertThat(result.getLong(2)).isEqualTo(7);
                            assertThat(result.getLong(3)).isEqualTo(7);
                            assertThat(result.getObject(4, OffsetDateTime.class).toInstant()).isEqualTo(timestamp.toInstant());
                            assertThat(result.getObject(5)).isNull(); assertThat(result.getObject(6)).isNull(); assertThat(result.getObject(7)).isNull();
                            assertThat(result.getString(8)).isEqualTo("PUBLISHED");
                        }
                        sql.setObject(1, legacyDraft);
                        try (var result = sql.executeQuery()) {
                            assertThat(result.next()).isTrue();
                            assertThat(result.getLong(2)).isEqualTo(3);
                            assertThat(result.getObject(3)).isNull(); assertThat(result.getObject(4)).isNull();
                            assertThat(result.getObject(5)).isNull(); assertThat(result.getObject(6)).isNull(); assertThat(result.getObject(7)).isNull();
                            assertThat(result.getString(8)).isEqualTo("DRAFT");
                        }
                    }
                    try (PreparedStatement sql = connection.prepareStatement("select security_version from users where id=?")) {
                        sql.setObject(1, user);
                        try (var result = sql.executeQuery()) { assertThat(result.next()).isTrue(); assertThat(result.getLong(1)).isZero(); }
                    }
                    rejects(connection, "update users set security_version=-1 where id='" + user + "'");
                    rejects(connection, "update cms_contents set public_updated_at=CURRENT_TIMESTAMP where id='" + legacyDraft + "'");
                    rejects(connection, "update cms_contents set public_revision=99 where id='" + published + "'");
                    rejects(connection, "update cms_contents set public_revision=0 where id='" + published + "'");
                    rejects(connection, "update cms_contents set public_updated_at=NULL where id='" + published + "'");
                    rejects(connection, "update cms_contents set draft_payload='{}'::jsonb where id='" + published + "'");
                    rejects(connection, "update cms_contents set draft_component_type='PAGE_LAYOUT',draft_payload='{}'::jsonb,draft_updated_at=CURRENT_TIMESTAMP where id='" + published + "'");
                    rejects(connection, "update cms_contents set draft_component_type='NOTICE',draft_payload='[]'::jsonb,draft_updated_at=CURRENT_TIMESTAMP where id='" + published + "'");
                    for (String slot : new String[]{"homepage.layout", "branches.detail-" + UUID.randomUUID() + ".layout", "benh-pho-bien.layout"}) {
                        insert(connection, UUID.randomUUID(), slot, "PAGE_LAYOUT", "DRAFT", 1, timestamp);
                    }
                    rejects(connection, insertSql("homepage.hero", "PAGE_LAYOUT"));
                    rejects(connection, insertSql("homepage.layout", "NOTICE"));
                    rejects(connection, insertSql("doctors.detail-not-a-uuid.layout", "PAGE_LAYOUT"));
                    rejects(connection, insertSql("admin.layout", "PAGE_LAYOUT"));
                    try (PreparedStatement sql = connection.prepareStatement("select count(*) from cms_content_changes")) {
                        try (var result = sql.executeQuery()) { assertThat(result.next()).isTrue(); assertThat(result.getLong(1)).isZero(); }
                    }
                } finally { connection.setSchema("public"); }
            }
        } finally {
            // Only this method's generated and validated throwaway schema is eligible for cleanup.
            assertThat(ownedSchema).matches("cms_snapshot_test_[0-9a-f]{32}");
            try (Connection connection = dataSource.getConnection()) {
                connection.setSchema("public");
                connection.createStatement().execute("drop schema if exists \"" + ownedSchema + "\" cascade");
            }
        }
    }

    private void migrate(String schema, String version) {
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").schemas(schema).defaultSchema(schema)
            .callbacks(new CatalogFixtureCallback()).target(version).load().migrate();
    }
    private void insert(Connection connection, UUID id, String slot, String type, String status, long version, OffsetDateTime time) throws SQLException {
        try (PreparedStatement sql = connection.prepareStatement("insert into cms_contents(id,slot_key,component_type,payload,status,version,created_at,updated_at) values (?,?,?,'{\"title\":\"Retained legacy payload\",\"body\":\"Synthetic\"}'::jsonb,?,?,?,?)")) {
            sql.setObject(1, id); sql.setString(2, slot); sql.setString(3, type); sql.setString(4, status);
            sql.setLong(5, version); sql.setObject(6, time); sql.setObject(7, time); sql.executeUpdate();
        }
    }
    private String insertSql(String slot, String type) {
        return "insert into cms_contents(id,slot_key,component_type,payload,status) values ('" + UUID.randomUUID()
            + "','" + slot + "','" + type + "','{}'::jsonb,'DRAFT')";
    }
    private void rejects(Connection connection, String sql) {
        assertThatThrownBy(() -> { try (var statement = connection.createStatement()) { statement.execute(sql); } })
            .isInstanceOf(SQLException.class).satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23514"));
    }
}
