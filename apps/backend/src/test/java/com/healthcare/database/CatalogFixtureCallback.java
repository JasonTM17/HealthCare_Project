package com.healthcare.database;

import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;

/**
 * Supplies the catalog rows that migrations V86 and V87 reference by fixed UUID
 * when the migration chain runs against an <em>empty</em> database.
 *
 * <p>V86 inserts appointments whose {@code branch_id}/{@code doctor_id}/
 * {@code package_id} must already exist, and V87 adds more of the same. A
 * production database acquired those rows through the admin CMS before the
 * migrations ran, and the migration chain itself never creates them, so every
 * fresh Testcontainers database failed at V86 ("insert or update on table
 * appointments violates foreign key constraint") and the whole integration
 * suite could not boot. The migrations are already applied in production, so
 * they cannot be edited (that would break Flyway checksum validation); the
 * fixture therefore runs just-in-time from the test harness instead, before
 * V86, and only when the referenced rows are still absent.
 *
 * <p>The fixture is a fixed classpath resource (no runtime input) and is
 * idempotent (fixed UUIDs, {@code ON CONFLICT DO NOTHING}); it contains
 * production-identical public catalog data only. One block additionally
 * provisions the two governance users in {@code public} itself, because V86
 * re-pins {@code health_question_answer_guard()} to
 * {@code SET search_path = public, extensions, pg_catalog} inside its own
 * script, so that guard keeps reading {@code public} even while the chain runs
 * in an isolated schema. See the comment in the fixture for the full reasoning.
 */
public class CatalogFixtureCallback implements Callback {

    private static final Logger log = LoggerFactory.getLogger(CatalogFixtureCallback.class);
    private static final String FIXTURE_RESOURCE = "db/test/v86-catalog-prerequisites.sql";
    private static final String ALIGN_RESOURCE = "db/test/align-guard-search-path.sql";
    private static final String V86 = "86";

    @Override
    public boolean supports(Event event, Context context) {
        return event == Event.BEFORE_EACH_MIGRATE;
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        MigrationInfo migration = context.getMigrationInfo();
        if (migration == null || migration.getVersion() == null
                || !V86.equals(migration.getVersion().getVersion())) {
            return;
        }
        ClassPathResource fixture = new ClassPathResource(FIXTURE_RESOURCE);
        if (!fixture.exists()) {
            log.warn("Catalog fixture {} not found on the test classpath; V86 may fail on an empty database",
                FIXTURE_RESOURCE);
            return;
        }
        // Flyway points the callback connection's search_path at the configured
        // default schema before each migration, so the fixture's unqualified
        // names resolve into the same schema the migration chain reads: public
        // for the Spring context, an isolated schema under FlywayMigrationTest.
        // Setting search_path here as well would fight Flyway's own handling
        // (a session-level override leaked into the following migration).
        ScriptUtils.executeSqlScript(
            context.getConnection(),
            new EncodedResource(fixture, StandardCharsets.UTF_8));
        alignGuardFunctionSearchPath(context);
        log.info("Applied {} before migration V86 (fresh-database catalog fixture)", FIXTURE_RESOURCE);
    }

    /**
     * Re-points the search-path-pinned guard functions at the schema actually under
     * migration.
     *
     * <p>Twenty-two migration-defined guard functions declare
     * {@code SET search_path = public, pg_catalog}, so their bodies resolve unqualified
     * table names against {@code public} regardless of where the caller lives. That is
     * correct in production, where Flyway owns {@code public}. {@code FlywayMigrationTest}
     * instead migrates into a throwaway {@code migration_test_<uuid>} schema while
     * {@code public} holds the Spring context's own copy of the chain, so a V86 row
     * inserted into the isolated schema is invisible to a trigger reading
     * {@code public.appointments} and the guard raises on a row that is present.
     *
     * <p>Production behaviour is preserved because the same re-point resolves to
     * {@code public} when the migration schema already is {@code public}. Applied at
     * V86 because that is the first migration that writes into a guard-protected table.
     */
    private void alignGuardFunctionSearchPath(Context context) {
        try {
            ScriptUtils.executeSqlScript(
                context.getConnection(),
                new EncodedResource(
                    new ClassPathResource(ALIGN_RESOURCE), StandardCharsets.UTF_8));
        } catch (ScriptException exception) {
            throw new IllegalStateException(
                "Failed to align guard function search_path with the migration schema", exception);
        }
    }

    @Override
    public String getCallbackName() {
        return "catalog-fixture-before-v86";
    }
}
