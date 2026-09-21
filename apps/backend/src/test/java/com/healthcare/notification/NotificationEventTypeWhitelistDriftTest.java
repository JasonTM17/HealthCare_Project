package com.healthcare.notification;

import com.healthcare.notification.entity.Notification.EventType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Drift guard for the two hand-maintained copies of the notification event
 * whitelist: {@link EventType} in Java and the {@code
 * chk_notifications_event_type} CHECK constraint rebuilt by
 * {@code V94__notification_role_matrix_event_types.sql}.
 *
 * <p>{@code NotificationService.create()} writes {@code EventType.name()} into
 * a VARCHAR column the database validates, so a value that exists on only one
 * side fails at INSERT time — in production, on the request that triggered the
 * notice. The Testcontainers suite already proves the enum-to-database
 * direction ({@code NotificationIntegrationTest} persists every value); this
 * test is the cheap, database-free version of both directions that names the
 * offending literal instead of surfacing a constraint violation.
 *
 * <p>The oracle is the highest-numbered migration that (re)defines the
 * constraint, so a future migration that legitimately extends the whitelist
 * becomes the new reference instead of being reported as drift.
 */
class NotificationEventTypeWhitelistDriftTest {

    private static final String CONSTRAINT = "chk_notifications_event_type";
    private static final String CURRENT_WHITELIST_MIGRATION =
        "V94__notification_role_matrix_event_types.sql";
    private static final String MIGRATION_RESOURCE = "db/migration/" + CURRENT_WHITELIST_MIGRATION;
    private static final Path MIGRATION_DIRECTORY = Path.of("src/main/resources/db/migration");
    private static final Pattern VERSION_PREFIX = Pattern.compile("^V(\\d+)__.*\\.sql$");
    private static final Pattern WHITELIST_ITEM = Pattern.compile("'([A-Z0-9_]+)'");

    @Test
    @DisplayName("EventType names are set-identical to the migration whitelist")
    void enumNamesMatchTheMigrationWhitelist() throws IOException {
        Set<String> migrationWhitelist = whitelistFromMigration();
        Set<String> enumNames = Arrays.stream(EventType.values()).map(Enum::name).collect(Collectors.toSet());

        assertThat(enumNames)
            .describedAs("%s allows event types the Java enum cannot produce", CURRENT_WHITELIST_MIGRATION)
            .containsAll(migrationWhitelist);
        assertThat(migrationWhitelist)
            .describedAs("Notification.EventType declares event types the database constraint rejects")
            .containsAll(enumNames);
        assertThat(enumNames).hasSameSizeAs(migrationWhitelist);
    }

    /** Literal list of the newest {@code ADD CONSTRAINT chk_notifications_event_type}. */
    private Set<String> whitelistFromMigration() throws IOException {
        String sql = readNewestWhitelistMigration();
        int anchor = sql.lastIndexOf("ADD CONSTRAINT " + CONSTRAINT);
        assertThat(anchor).as("%s must be defined by the migration chain", CONSTRAINT).isNotNegative();
        String tail = sql.substring(anchor);
        int open = tail.indexOf("IN (");
        assertThat(open).as("expected an IN ( ... ) whitelist after the constraint name").isNotNegative();
        // `open` indexes the "IN (" anchor, so the list itself starts at its '(' —
        // slicing from `open + 2` would leave the '(' glued to the first literal.
        int listStart = tail.indexOf('(', open) + 1;
        int close = tail.indexOf(')', listStart);
        assertThat(close).as("unterminated whitelist in %s", CURRENT_WHITELIST_MIGRATION).isGreaterThan(listStart);

        List<String> literals = Arrays.stream(tail.substring(listStart, close).split(","))
            .map(String::trim)
            .filter(chunk -> !chunk.isEmpty())
            .map(chunk -> {
                Matcher matcher = WHITELIST_ITEM.matcher(chunk);
                assertThat(matcher.matches()).as("unexpected whitelist entry: %s", chunk).isTrue();
                return matcher.group(1);
            })
            .toList();
        assertThat(literals).as("the whitelist parsed to nothing; the parser is stale").isNotEmpty();
        return Set.copyOf(literals);
    }

    private String readNewestWhitelistMigration() throws IOException {
        if (Files.isDirectory(MIGRATION_DIRECTORY)) {
            int newestVersion = -1;
            String newestSql = null;
            for (Path file : Files.list(MIGRATION_DIRECTORY).toList()) {
                Matcher version = VERSION_PREFIX.matcher(file.getFileName().toString());
                if (!version.matches()) {
                    continue;
                }
                String sql = Files.readString(file, StandardCharsets.UTF_8);
                if (!sql.contains("ADD CONSTRAINT " + CONSTRAINT)) {
                    continue;
                }
                int parsed = Integer.parseInt(version.group(1));
                if (parsed > newestVersion) {
                    newestVersion = parsed;
                    newestSql = sql;
                }
            }
            if (newestSql != null) {
                return newestSql;
            }
        }
        // Outside a source checkout (a different working directory, a packaged
        // jar) fall back to the constraint's current definition on the
        // classpath — the same bytes Flyway applies.
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(MIGRATION_RESOURCE)) {
            assertThat(in).as("%s must stay on the classpath", MIGRATION_RESOURCE).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
