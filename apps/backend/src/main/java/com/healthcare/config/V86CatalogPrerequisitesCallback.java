package com.healthcare.config;

import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Supplies the catalog rows that migration V86 references by fixed UUID when
 * the migration chain runs against an <em>empty</em> database.
 *
 * <p>V86 inserts appointments whose {@code branch_id}/{@code doctor_id}/
 * {@code package_id} must already exist, and the migration chain itself never
 * creates them (production databases acquired those rows through the admin CMS
 * before the chain ran). Without this fixture, every fresh volume — a new
 * compose stack, a new local database, disaster recovery replay — fails at V86
 * with a foreign-key violation. The migrations are already applied in
 * production, so they cannot be edited (checksum validation); the fixture
 * instead runs just-in-time, before V86, only when the chain actually reaches
 * that point.
 *
 * <p>The fixture is a fixed classpath resource (no runtime input) and is
 * idempotent within a session: catalog rows insert via {@code INSERT ...
 * SELECT ... WHERE NOT EXISTS} and the user rows via {@code ON CONFLICT DO
 * NOTHING}, all with fixed UUIDs, so a database that already holds them sees
 * a no-op. Safety under concurrent boots rests on Flyway's cluster lock
 * serializing migrations, not on row-level conflict clauses. It contains
 * production-identical public catalog data only. In the integration suite the
 * test-only {@code CatalogFixtureCallback} runs the identical resource plus
 * the isolated-schema guard alignment, so the fixture executes twice there —
 * harmless by the same in-session idempotency.
 *
 * <p>Registered as a plain {@link Component}: Spring Boot's Flyway
 * auto-configuration collects every {@link Callback} bean, the same mechanism
 * the test harness uses.
 */
@Component
public class V86CatalogPrerequisitesCallback implements Callback {

    private static final Logger log = LoggerFactory.getLogger(V86CatalogPrerequisitesCallback.class);
    private static final String FIXTURE_RESOURCE = "db/catalog/v86-catalog-prerequisites.sql";
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
            log.warn("Catalog fixture {} not found on the classpath; V86 may fail on an empty database",
                FIXTURE_RESOURCE);
            return;
        }
        // Flyway points the callback connection's search_path at the configured
        // default schema before each migration, so the fixture's unqualified
        // names resolve into the same schema the migration chain reads.
        ScriptUtils.executeSqlScript(
            context.getConnection(),
            new EncodedResource(fixture, StandardCharsets.UTF_8));
        log.info("Applied {} before migration V86 (fresh-database catalog fixture)", FIXTURE_RESOURCE);
    }

    @Override
    public String getCallbackName() {
        return "v86-catalog-prerequisites-before-migrate";
    }
}
