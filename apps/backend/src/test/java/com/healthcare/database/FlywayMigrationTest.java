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
import java.util.Map;
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

    // The catalog rows db/seed/seed-local-data.sql and
    // db/seed/seed-local-rich-content.sql own. richLocalSeedOverlayPopulatesV15ContentContracts
    // measures the overlay against these slugs instead of a schema-wide total.
    private static final String SEEDED_SPECIALTY_SLUGS =
        "('tim-mach','than-kinh','tieu-hoa','noi-tong-hop','nhi-khoa','san-phu-khoa',"
            + "'co-xuong-khop','tai-mui-hong')";
    private static final String SEEDED_BRANCH_SLUGS =
        "('benh-vien-sai-gon-xanh','phong-kham-thao-dien')";
    private static final String SEEDED_PACKAGE_SLUGS =
        "('goi-kham-co-ban','goi-kham-tim-mach','goi-tam-soat-tieu-duong','goi-kham-tre-em')";
    private static final String SEEDED_ARTICLE_SLUGS =
        "('dau-hieu-canh-bao-benh-tim-mach','dinh-duong-hop-ly-nguoi-tang-huyet-ap',"
            + "'tre-bieng-an-hieu-dung-de-cham-dung')";

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
    void patientChatV34DefaultsAndGovernanceTablesArePresent() {
        List<String> chatColumns = jdbcTemplate.queryForList("""
            select column_name
              from information_schema.columns
             where table_schema = 'public' and table_name = 'ai_conversations'
             order by ordinal_position
            """, String.class);
        assertThat(chatColumns).contains("mode", "consent_version", "consented_at");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from information_schema.tables "
                + "where table_schema = 'public' and table_name in "
                + "('ai_message_feedback','ai_content_revisions','ai_content_review_heads',"
                + "'ai_content_approval_rounds','ai_content_review_events')",
            Integer.class
        )).isEqualTo(5);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from pg_sequences where schemaname = 'public' "
                + "and sequencename = 'ai_catalog_sync_revision_seq'",
            Integer.class
        )).isEqualTo(1);

        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into users(id, email, password_hash, display_name, status)
            values (?, ?, 'test-hash', 'Migration Patient', 'ACTIVE')
            """, userId, "migration-chat-" + userId + "@healthcare.local");
        jdbcTemplate.update("""
            insert into ai_conversations(id, user_id, title, expires_at)
            values (?, ?, 'Legacy chat', CURRENT_TIMESTAMP + INTERVAL '90 days')
            """, conversationId, userId);
        Map<String, Object> row = jdbcTemplate.queryForMap(
            "select mode, consent_version, consented_at from ai_conversations where id = ?",
            conversationId);
        assertThat(row.get("mode")).isEqualTo("HOSPITAL_SUPPORT");
        assertThat(row.get("consent_version")).isNull();
        assertThat(row.get("consented_at")).isNull();
    }

    @Test
    void consultationAuditIsNullableAndUsesSetNullRetentionBoundary() {
        assertThat(jdbcTemplate.queryForObject("""
            select is_nullable
              from information_schema.columns
             where table_schema = 'public'
               and table_name = 'patient_consultation_events'
               and column_name = 'thread_id'
            """, String.class)).isEqualTo("YES");
        assertThat(jdbcTemplate.queryForObject("""
            select delete_rule
              from information_schema.referential_constraints
             where constraint_schema = 'public'
               and constraint_name = 'fk_patient_consultation_event_thread'
            """, String.class)).isEqualTo("SET NULL");
        assertThat(jdbcTemplate.queryForObject("""
            select pg_get_functiondef(p.oid)
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname = 'patient_consultation_event_immutable'
            """, String.class)).contains("healthcare.retention_cleanup");
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

        jdbcTemplate.update(
            "update users set password_hash = ?, display_name = ?, status = ? where email = ?",
            "stale-demo-hash", "Stale administrator", "DISABLED", "admin@healthcare.local"
        );
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
            "select count(*) from cms_content_changes " +
                "where slot_key in ('homepage.hero','homepage.body','careers.hero','careers.body','search.hero') " +
                "and content_version = 1 and published = true and public_event = true " +
                "and actor_email = 'seed@healthcare.local'",
            Integer.class
        )).isEqualTo(5);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from cms_contents where payload::text ilike '%patient%'",
            Integer.class
        )).isZero();
        assertThat(jdbcTemplate.queryForObject(
            "select password_hash from users where email = 'admin@healthcare.local'",
            String.class
        )).isEqualTo("$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa");
        assertThat(jdbcTemplate.queryForObject(
            "select display_name || '|' || status from users where email = 'admin@healthcare.local'",
            String.class
        )).isEqualTo("Quản trị viên Local|ACTIVE");
    }

    @Test
    void largeSeedPersistsDurableCmsEventsForRealtimeBootstrap() {
        String schema = createMigrationSchema();
        try {
            migrateLatest(schema);
            // V86 publishes the same five slots through its own durable-event
            // block (actor admin@healthcare.id.vn), and the large seed
            // deliberately emits no synthetic event for content a newer actor
            // already owns. The public-schema sibling test only reaches the seed
            // with those rows gone, because AbstractIntegrationTest#cleanDatabase
            // truncates the CMS tables before every method. Remove the chain's
            // rows for the seeded slots here too so both seeds start from the
            // same precondition; the assertions below still demand the seed's
            // own five attributed, unduplicated, fully-joined events.
            String seededSlots = "('homepage.hero','homepage.body','careers.hero','careers.body','search.hero')";
            jdbcTemplate.update(
                "delete from " + table(schema, "cms_content_changes")
                    + " where slot_key in " + seededSlots);
            jdbcTemplate.update(
                "delete from " + table(schema, "cms_contents")
                    + " where slot_key in " + seededSlots);
            executeLargeSeed(schema);
            executeLargeSeed(schema);

            String contents = table(schema, "cms_contents");
            String changes = table(schema, "cms_content_changes");

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + contents + " where slot_key in " + seededSlots,
                Integer.class
            )).isEqualTo(5);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + changes
                    + " where slot_key in " + seededSlots
                    + " and content_version = 1 and published = true and public_event = true"
                    + " and actor_email = 'seed@healthcare.local'",
                Integer.class
            )).isEqualTo(5);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from ("
                    + "select content_id, content_version, count(*)"
                    + " from " + changes
                    + " where slot_key in " + seededSlots
                    + " and public_event = true"
                    + " group by content_id, content_version having count(*) > 1"
                    + ") duplicate_seed_events",
                Integer.class
            )).isZero();
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + changes + " change"
                    + " left join " + contents + " content on content.id = change.content_id"
                    + " where change.slot_key in " + seededSlots
                    + " and change.public_event = true"
                    + " and content.id is null",
                Integer.class
            )).isZero();
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void localCareerSeedIsIdempotentAfterV22() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "22");
            executeCareerSeed(schema);
            executeCareerSeed(schema);

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "job_positions"),
                Integer.class
            )).isEqualTo(4);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "job_positions") + " where active = true",
                Integer.class
            )).isEqualTo(4);
            assertThat(jdbcTemplate.queryForList(
                "select slug from " + table(schema, "job_positions") + " order by slug",
                String.class
            )).containsExactly(
                "chuyen-vien-cham-soc-khach-hang",
                "dieu-duong-da-khoa",
                "ky-thuat-vien-xet-nghiem",
                "thuc-tap-sinh-hanh-chinh-nhan-su"
            );
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "job_applications"),
                Integer.class
            )).isZero();
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v23PreflightDiagnosesLegacyPrivateCmsSlotsBeforeConstraints() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "22");
            UUID contentId = UUID.randomUUID();
            String contents = table(schema, "cms_contents");
            String changes = table(schema, "cms_content_changes");

            jdbcTemplate.update(
                "insert into " + contents
                    + " (id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                    + "values (?, ?, 'NOTICE', '{}'::jsonb, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                contentId,
                "patient.dashboard.hero"
            );
            jdbcTemplate.update(
                "insert into " + changes
                    + " (content_id, slot_key, content_version, published, public_event) "
                    + "values (?, ?, 1, false, false)",
                contentId,
                "patient.dashboard.hero"
            );

            Throwable failure = catchThrowable(() -> migrate(schema, "23"));

            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains(
                "V23 preflight failed",
                "legacy CMS slot keys outside the public route inventory",
                "patient.dashboard.hero",
                "Repair or explicitly reassign/delete private slots",
                "never deletes production CMS data"
            );
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + contents + " where slot_key = ?",
                Integer.class,
                "patient.dashboard.hero"
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v24PreflightDiagnosesLegacyCmsSlotComponentRowsBeforeConstraints() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "23");
            UUID contentId = UUID.randomUUID();
            String contents = table(schema, "cms_contents");
            String changes = table(schema, "cms_content_changes");

            jdbcTemplate.update(
                "insert into " + contents
                    + " (id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                    + "values (?, ?, 'NOTICE', '{}'::jsonb, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                contentId,
                "homepage.hero"
            );
            jdbcTemplate.update(
                "insert into " + changes
                    + " (content_id, slot_key, content_version, published, public_event, component_type) "
                    + "values (?, ?, 1, false, false, 'NOTICE')",
                contentId,
                "homepage.hero"
            );

            Throwable failure = catchThrowable(() -> migrate(schema, "24"));

            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains(
                "V24 preflight failed",
                "legacy CMS slot/component combinations",
                "homepage.hero=NOTICE",
                "Repair or explicitly reassign/delete invalid CMS rows",
                "never deletes production CMS data"
            );
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + contents + " where slot_key = ?",
                Integer.class,
                "homepage.hero"
            )).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + changes + " where slot_key = ? and component_type = 'NOTICE'",
                Integer.class,
                "homepage.hero"
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v62SeedDoesNotMutatePreExistingRuntimeGovernanceHeads() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "61");

            // Simulate a database that ran a pre-V62 backend: the runtime
            // catalog sync already recorded a rich rev-1 revision and a DRAFT
            // review head for the demo cardiology specialty before the V62
            // seed ever ran. The seed must leave this head untouched instead
            // of violating trg_ai_content_review_heads_monotonic or anchoring
            // the head to a hash that has no revision row.
            String revisions = table(schema, "ai_content_revisions");
            String heads = table(schema, "ai_content_review_heads");
            String runtimeSnapshot = "{\"name\": \"Tim mach runtime\", \"slug\": \"tim-mach\"}";
            jdbcTemplate.update(
                "insert into " + revisions
                    + " (source_type, source_id, content_revision, content_hash, content_snapshot, created_by) "
                    + "values ('SPECIALTY', '10000000-0000-0000-0000-000000000001', 1, "
                    + "encode(digest(convert_to(?::jsonb::text, 'UTF8'), 'sha256'), 'hex'), ?::jsonb, "
                    + "(select id from users where email = 'admin@healthcare.com'))",
                runtimeSnapshot, runtimeSnapshot
            );
            jdbcTemplate.update(
                "insert into " + heads
                    + " (source_type, source_id, content_revision, content_hash, "
                    + "eligibility_revision, eligibility_state, edited_by) "
                    + "select 'SPECIALTY', '10000000-0000-0000-0000-000000000001', 1, "
                    + "content_hash, 1, 'DRAFT', created_by from " + revisions
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001' "
                    + "and content_revision = 1"
            );
            String runtimeHash = jdbcTemplate.queryForObject(
                "select content_hash from " + revisions
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001' "
                    + "and content_revision = 1",
                String.class
            );

            migrateLatest(schema);

            // The seed must not have touched the runtime-owned head.
            assertThat(jdbcTemplate.queryForObject(
                "select eligibility_state || '|' || eligibility_revision || '|' || content_revision "
                    + "from " + heads
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001'",
                String.class
            )).isEqualTo("DRAFT|1|1");
            assertThat(jdbcTemplate.queryForObject(
                "select content_hash from " + heads
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001'",
                String.class
            )).isEqualTo(runtimeHash);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + revisions
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001'",
                Integer.class
            )).isEqualTo(1);

            // The seed-only insert path still seeds demo heads that are absent.
            assertThat(jdbcTemplate.queryForList(
                "select eligibility_state from " + heads
                    + " where source_type = 'ARTICLE' "
                    + "and source_id in ('a1000000-0000-0000-0000-000000000001', "
                    + "'a1000000-0000-0000-0000-000000000002') order by source_id",
                String.class
            )).containsExactly("SUBMITTED", "SUBMITTED");
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v62SeedsApprovedSpecialtyHeadOnFreshLineage() {
        String schema = createMigrationSchema();
        try {
            migrateLatest(schema);

            // Fresh deployments have no runtime-owned head, so the demo
            // APPROVED cardiology head is seeded and FK-anchored to the
            // matching revision row.
            assertThat(jdbcTemplate.queryForObject(
                "select eligibility_state || '|' || eligibility_revision || '|' || current_approval_round "
                    + "from " + table(schema, "ai_content_review_heads")
                    + " where source_type = 'SPECIALTY' "
                    + "and source_id = '10000000-0000-0000-0000-000000000001'",
                String.class
            )).isEqualTo("APPROVED|1|1");
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "ai_content_revisions") + " revision "
                    + "join " + table(schema, "ai_content_review_heads") + " head "
                    + "on head.source_type = revision.source_type "
                    + "and head.source_id = revision.source_id "
                    + "and head.content_revision = revision.content_revision "
                    + "and head.content_hash = revision.content_hash "
                    + "where revision.source_type = 'SPECIALTY' "
                    + "and revision.source_id = '10000000-0000-0000-0000-000000000001'",
                Integer.class
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v100HidesDemoDoctorsAndUnpublishesE2eFixturesWithoutDeletingRows() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "99");
            for (int ordinal = 1; ordinal <= 8; ordinal++) {
                insertDoctor(schema, "Bác sĩ mẫu " + ordinal + " - Tim mạch",
                    "demo-bs-v100-" + ordinal, true);
            }
            // A second set belonging to another branch, exactly like V67's
            // per-branch expansion; both sets must end up hidden.
            insertDoctor(schema, "Bác sĩ mẫu 1 - Thần kinh", "demo-bs-v100-branch2-1", true);
            insertDoctor(schema, "Bác sĩ mẫu 2 - Tiêu hóa", "demo-bs-v100-branch2-2", true);
            insertDoctor(schema, "Bác sĩ Trần Thị Thật", "v100-control-doctor", true);
            insertPublishedArticle(schema, "e2e-round7-nhip-tim-cham---khi-nao-can-gap-bac-si", true);
            insertPublishedArticle(schema, "dau-hieu-canh-bao-benh-tim-mach", false);

            migrate(schema, "100");

            // All ten demo doctors still exist; the V67 naming predicate hid
            // every one of them, and no non-demo profile was touched.
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "doctors")
                    + " where full_name like 'Bác sĩ mẫu %'",
                Integer.class
            )).isEqualTo(10);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "doctors")
                    + " where full_name like 'Bác sĩ mẫu %' and active = true",
                Integer.class
            )).isZero();
            assertThat(jdbcTemplate.queryForObject(
                "select active from " + table(schema, "doctors") + " where slug = 'v100-control-doctor'",
                Boolean.class
            )).isTrue();

            // The fixture is unpublished, keeps its row and its APPROVED review
            // trail, and loses the schedule so the publication sweeper cannot
            // republish it one tick after the hide.
            Map<String, Object> fixture = jdbcTemplate.queryForMap(
                "select published_at, scheduled_publish_at, review_status, active "
                    + "from " + table(schema, "articles")
                    + " where slug = 'e2e-round7-nhip-tim-cham---khi-nao-can-gap-bac-si'");
            assertThat(fixture.get("published_at")).isNull();
            assertThat(fixture.get("scheduled_publish_at")).isNull();
            assertThat(fixture.get("review_status")).isEqualTo("APPROVED");
            assertThat(fixture.get("active")).isEqualTo(true);

            // The real article is untouched.
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "articles")
                    + " where slug = 'dau-hieu-canh-bao-benh-tim-mach' and published_at is not null",
                Integer.class
            )).isEqualTo(1);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v100AbortsInsteadOfMassUpdatingWhenDemoDoctorCountDriftsBelowBounds() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "99");
            // Only three V67-named doctors: candidates exist but the affected
            // count cannot land in [8, 32], so the migration must abort.
            for (int ordinal = 1; ordinal <= 3; ordinal++) {
                insertDoctor(schema, "Bác sĩ mẫu " + ordinal + " - Tim mạch",
                    "demo-bs-v100-drift-" + ordinal, true);
            }

            Throwable failure = catchThrowable(() -> migrate(schema, "100"));

            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains("V100 guard failed", "[8, 32]");
            // The abort rolled the guarded UPDATE back: rows exist and are active.
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "doctors")
                    + " where full_name like 'Bác sĩ mẫu %' and active = true",
                Integer.class
            )).isEqualTo(3);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v100AbortsInsteadOfMassUpdatingWhenE2eArticleCountDriftsAboveBounds() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "99");
            for (int index = 1; index <= 25; index++) {
                insertPublishedArticle(schema, "e2e-bulk-drift-fixture-" + index, false);
            }

            Throwable failure = catchThrowable(() -> migrate(schema, "100"));

            assertThat(failure).isNotNull();
            assertThat(allMessages(failure)).contains("V100 guard failed", "[1, 20]");
            // No fixture lost its publication: the transaction was aborted.
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "articles")
                    + " where slug like 'e2e-%' and published_at is not null",
                Integer.class
            )).isEqualTo(25);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v100SkipsBothGuardsOnAFreshChainWithoutDemoOrE2eRows() {
        String schema = createMigrationSchema();
        try {
            // V67 cross-joins a catalog that only V95 seeds later, so a fresh
            // chain reaches V100 with zero candidates. Without the skip branch
            // every fresh deployment and Testcontainers schema would abort.
            migrateLatest(schema);

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "doctors")
                    + " where full_name like 'Bác sĩ mẫu %'",
                Integer.class
            )).isZero();
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "articles")
                    + " where slug like 'e2e-%' and published_at is not null",
                Integer.class
            )).isZero();
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v101MarksOnlyUnbackedSeedDocumentsFailedAndKeepsTheirSources() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "100");
            String documents = table(schema, "patient_documents");
            String seedMarker = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + documents
                    + " where status = 'AVAILABLE' and sha256 = ? and byte_size = 384512",
                Integer.class, seedMarker
            )).isEqualTo(14);

            // A row whose object metadata has been repaired must survive the
            // migration unchanged, even though its ID is from the seed set.
            String repairedId = "80000000-0000-0000-00a0-000000000001";
            jdbcTemplate.update(
                "update " + documents + " set sha256 = repeat('a', 64), byte_size = 1024 where id = ?::uuid",
                repairedId
            );

            migrate(schema, "101");

            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + documents
                    + " where status = 'AVAILABLE' and sha256 = ? and byte_size = 384512",
                Integer.class, seedMarker
            )).isZero();
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + documents
                    + " where status = 'FAILED' and sha256 is null and byte_size is null",
                Integer.class
            )).isEqualTo(13);
            assertThat(jdbcTemplate.queryForObject(
                "select status || '|' || sha256 || '|' || byte_size from " + documents + " where id = ?::uuid",
                String.class, repairedId
            )).isEqualTo("AVAILABLE|" + "a".repeat(64) + "|1024");
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + documents + " where source_record_id is not null",
                Integer.class
            )).isEqualTo(14);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    @Test
    void v102AllowsDocumentActionsAndStillRejectsUnknownAuditActions() {
        String schema = createMigrationSchema();
        try {
            migrate(schema, "101");
            String audit = table(schema, "clinical_access_audit");
            String insert = "insert into " + audit
                + " (id, actor_email, actor_role, target_type, target_id, action, decision)"
                + " values (?, 'demo@example.invalid', 'PATIENT', 'DOCUMENT', 'demo-document', ?, 'ALLOW')";

            assertThatThrownBy(() -> jdbcTemplate.update(insert, UUID.randomUUID(), "GENERATE"))
                .isInstanceOf(DataAccessException.class);
            migrate(schema, "102");

            jdbcTemplate.update(insert, UUID.randomUUID(), "GENERATE");
            jdbcTemplate.update(insert, UUID.randomUUID(), "REVOKE");
            jdbcTemplate.update(insert, UUID.randomUUID(), "READ");
            jdbcTemplate.update(insert, UUID.randomUUID(), "ADMIN_CANCEL_APPOINTMENT");
            assertThatThrownBy(() -> jdbcTemplate.update(insert, UUID.randomUUID(), "UNKNOWN"))
                .isInstanceOf(DataAccessException.class);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + audit + " where target_type = 'DOCUMENT'",
                Integer.class
            )).isEqualTo(4);
        } finally {
            dropMigrationSchema(schema);
        }
    }

    private void insertDoctor(String schema, String fullName, String slug, boolean active) {
        jdbcTemplate.update(
            "insert into " + table(schema, "doctors") + " (id, full_name, slug, active) "
                + "values (?, ?, ?, ?)",
            UUID.randomUUID(), fullName, slug, active
        );
    }

    private void insertPublishedArticle(String schema, String slug, boolean scheduled) {
        jdbcTemplate.update(
            "insert into " + table(schema, "articles")
                + " (id, title, slug, summary, body, published_at, scheduled_publish_at) "
                + "values (?, ?, ?, ?, ?, CURRENT_TIMESTAMP - INTERVAL '1 day', "
                + (scheduled ? "CURRENT_TIMESTAMP - INTERVAL '2 days'" : "NULL") + ")",
            UUID.randomUUID(), "Bài viết " + slug, slug,
            "Tóm tắt fixture " + slug, "Nội dung fixture " + slug
        );
    }

    @Test
    void cmsSlotKeysAreBoundToPublicRouteInventoryAtDatabaseBoundary() {
        UUID contentId = UUID.randomUUID();
        jdbcTemplate.update("delete from cms_content_changes where slot_key in (?, ?)", "contact.footer", "patient.dashboard.hero");
        jdbcTemplate.update("delete from cms_contents where slot_key in (?, ?)", "contact.footer", "patient.dashboard.hero");

        jdbcTemplate.update(
            "insert into cms_contents "
                + "(id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                + "values (?, ?, 'NOTICE', '{}'::jsonb, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            contentId,
            "contact.footer"
        );
        jdbcTemplate.update(
            "insert into cms_content_changes "
                + "(content_id, slot_key, content_version, published, public_event) "
                + "values (?, ?, 1, false, false)",
            contentId,
            "contact.footer"
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
            "insert into cms_contents "
                + "(id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                + "values (?, ?, 'NOTICE', '{}'::jsonb, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(),
            "patient.dashboard.hero"
        )).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
            "insert into cms_content_changes "
                + "(content_id, slot_key, content_version, published, public_event) "
                + "values (?, ?, 1, false, false)",
            contentId,
            "patient.dashboard.hero"
        )).isInstanceOf(DataAccessException.class);
    }

    @Test
    void cmsSlotComponentTypesAreEnforcedAtDatabaseBoundary() {
        UUID validHeroId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into cms_contents "
                + "(id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                + "values (?, ?, 'HERO', '{}'::jsonb, 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            validHeroId,
            "homepage.hero"
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
            "insert into cms_contents "
                + "(id, slot_key, component_type, payload, status, version, created_at, updated_at) "
                + "values (?, ?, 'RICH_TEXT', '{}'::jsonb, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(),
            "careers.hero"
        )).isInstanceOf(DataAccessException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
            "insert into cms_content_changes "
                + "(content_id, slot_key, content_version, published, public_event, component_type) "
                + "values (?, ?, 1, true, true, 'RICH_TEXT')",
            validHeroId,
            "homepage.hero"
        )).isInstanceOf(DataAccessException.class);
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
            migrate(schema, "22");
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
    void richLocalSeedOverlayPopulatesV15ContentContracts() {
        String schema = createMigrationSchema();
        try {
            // The assertions below exercise the detail columns introduced by
            // V15, while the full local seed now also owns careers data added
            // in V22. Apply the complete migration chain before loading it.
            migrateLatest(schema);
            executeSeed(schema);
            executeRichSeed(schema);

            jdbcTemplate.update(
                "update " + table(schema, "specialties")
                    + " set common_symptoms = '[\"Admin-owned symptom\"]'::jsonb"
                    + " where slug = 'tim-mach'"
            );
            jdbcTemplate.update(
                "update " + table(schema, "packages")
                    + " set checklist = '[\"Admin-owned checklist\"]'::jsonb"
                    + " where slug = 'goi-kham-co-ban'"
            );
            executeRichSeed(schema);

            // The counts are scoped to the rows the two local seeds ship. A
            // schema-wide total is no longer a measure of this overlay: V95
            // seeds a second (An Tam) catalogue with its own amenities and
            // checklists, and V86/V92 publish additional article sections, so an
            // unscoped count reports how many rows the whole chain carries rather
            // than whether the overlay filled every V15 contract it owns. Each
            // scoped expectation still demands all of the seed's own rows.
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "specialties")
                    + " where slug in " + SEEDED_SPECIALTY_SLUGS
                    + " and jsonb_array_length(common_symptoms) > 0",
                Integer.class
            )).isEqualTo(8);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "branches")
                    + " where slug in " + SEEDED_BRANCH_SLUGS
                    + " and jsonb_array_length(amenities) > 0",
                Integer.class
            )).isEqualTo(2);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "packages")
                    + " where slug in " + SEEDED_PACKAGE_SLUGS
                    + " and jsonb_array_length(checklist) > 0",
                Integer.class
            )).isEqualTo(4);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from " + table(schema, "articles")
                    + " where slug in " + SEEDED_ARTICLE_SLUGS
                    + " and jsonb_array_length(sections) > 0",
                Integer.class
            )).isEqualTo(3);
            assertThat(jdbcTemplate.queryForObject(
                "select common_symptoms ->> 0 from " + table(schema, "specialties")
                    + " where slug = 'tim-mach'",
                String.class
            )).isEqualTo("Admin-owned symptom");
            assertThat(jdbcTemplate.queryForObject(
                "select checklist ->> 0 from " + table(schema, "packages")
                    + " where slug = 'goi-kham-co-ban'",
                String.class
            )).isEqualTo("Admin-owned checklist");
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
            // Same just-in-time catalog fixture as migrateLatest: harmless for
            // targets below 86 (it only fires before V86) and required for any
            // test that walks the chain to 99/100 on an isolated schema.
            .callbacks(new CatalogFixtureCallback())
            .target(MigrationVersion.fromVersion(target))
            .load()
            .migrate();
    }

    private void migrateLatest(String schema) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .schemas(schema)
            .defaultSchema(schema)
            // V86/V87 reference catalog rows a production database supplied
            // through the admin CMS; seed them just-in-time on fresh schemas.
            .callbacks(new CatalogFixtureCallback())
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

    private void executeLargeSeed(String schema) {
        try (Connection connection = dataSource.getConnection()) {
            connection.createStatement().execute("set search_path to " + identifier(schema));
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(
                    new ClassPathResource("db/seed/seed-large-data.sql"),
                    StandardCharsets.UTF_8
                )
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to execute large seed in isolated migration schema", exception);
        }
    }

    private void executeRichSeed(String schema) {
        try (Connection connection = dataSource.getConnection()) {
            connection.createStatement().execute("set search_path to " + identifier(schema));
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(
                    new ClassPathResource("db/seed/seed-local-rich-content.sql"),
                    StandardCharsets.UTF_8
                )
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to execute rich local seed overlay in isolated migration schema", exception);
        }
    }

    private void executeCareerSeed(String schema) {
        try (Connection connection = dataSource.getConnection()) {
            connection.createStatement().execute("set search_path to " + identifier(schema));
            ScriptUtils.executeSqlScript(
                connection,
                new EncodedResource(
                    new ClassPathResource("db/seed/seed-local-careers.sql"),
                    StandardCharsets.UTF_8
                )
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to execute local career seed in isolated migration schema", exception);
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
