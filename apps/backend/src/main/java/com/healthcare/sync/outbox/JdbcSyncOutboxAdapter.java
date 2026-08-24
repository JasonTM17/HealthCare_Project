package com.healthcare.sync.outbox;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * PostgreSQL-backed implementation of the internal sync outbox port.
 *
 * <p>The additive backend migration that owns this adapter is expected to
 * provide {@code sync_outbox_events} with the following server-side columns:
 * {@code event_id}, {@code cursor}, {@code entity_classification},
 * {@code entity_type}, {@code entity_id}, {@code revision}, {@code operation},
 * {@code content_hash}, optional {@code source_revision} and
 * {@code eligibility_revision}, {@code occurred_at}, {@code correlation_id},
 * generated {@code idempotency_key}, {@code status}, {@code attempt_count},
 * {@code available_at}, {@code claimed_at}, {@code lease_expires_at},
 * {@code lease_token}, {@code worker_id}, {@code acknowledged_at} and
 * {@code updated_at}. The schema must enforce uniqueness for event id,
 * idempotency key, and entity classification/type/id/revision.</p>
 *
 * <p>No event payload is accepted or persisted. The entity reference is only
 * a server-owned UUID projection key; consumers must resolve content through
 * an authorized server-side projection.</p>
 */
@Repository
public class JdbcSyncOutboxAdapter implements SyncOutboxPort {

    private static final String SELECT_COLUMNS = """
        event_id,
        "cursor" AS cursor_value,
        entity_classification,
        entity_type,
        entity_id,
        revision,
        operation,
        content_hash,
        source_revision,
        eligibility_revision,
        occurred_at,
        correlation_id,
        status,
        attempt_count,
        lease_token,
        lease_expires_at,
        available_at
        """;

    private static final String SELECT_BY_EVENT_ID = """
        SELECT %s
        FROM sync_outbox_events
        WHERE event_id = ?
        FOR UPDATE
        """.formatted(SELECT_COLUMNS);

    private static final String SELECT_LATEST_FOR_ENTITY = """
        SELECT %s
        FROM sync_outbox_events
        WHERE entity_classification = ?
          AND entity_type = ?
          AND entity_id = ?
        ORDER BY revision DESC, "cursor" DESC
        LIMIT 1
        FOR UPDATE
        """.formatted(SELECT_COLUMNS);

    private static final String INSERT_EVENT = """
        INSERT INTO sync_outbox_events (
            event_id,
            entity_classification,
            entity_type,
            entity_id,
            revision,
            operation,
            content_hash,
            source_revision,
            eligibility_revision,
            occurred_at,
            correlation_id,
            status,
            attempt_count,
            available_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)
        ON CONFLICT DO NOTHING
        RETURNING %s
        """.formatted(SELECT_COLUMNS);

    /**
     * The first currently blocked event is a cursor barrier. This prevents a
     * worker from advancing a checkpoint past an active or not-yet-available
     * event, which would otherwise make that event unreachable after a retry.
     */
    private static final String SELECT_CLAIMABLE_EVENTS = """
        WITH first_blocked AS (
            SELECT COALESCE(MIN("cursor"), 9223372036854775807) AS blocked_cursor
            FROM sync_outbox_events
            WHERE "cursor" > ?
              AND status NOT IN ('PROCESSED', 'DEAD_LETTER')
              AND NOT (
                    (status IN ('PENDING', 'RETRYABLE') AND available_at <= ?)
                    OR (status = 'PROCESSING' AND lease_expires_at <= ?)
              )
        )
        SELECT %s
        FROM sync_outbox_events event
        CROSS JOIN first_blocked
        WHERE event."cursor" > ?
          AND event."cursor" < first_blocked.blocked_cursor
          AND (
                (event.status IN ('PENDING', 'RETRYABLE') AND event.available_at <= ?)
                OR (event.status = 'PROCESSING' AND event.lease_expires_at <= ?)
          )
        ORDER BY event."cursor"
        LIMIT ?
        FOR UPDATE
        """.formatted(SELECT_COLUMNS);

    private static final String SELECT_CLAIMABLE_CLINICAL_EVENTS = """
        WITH first_blocked AS (
            SELECT COALESCE(MIN("cursor"), 9223372036854775807) AS blocked_cursor
            FROM sync_outbox_events
            WHERE "cursor" > ?
              AND entity_classification = ?
              AND status NOT IN ('PROCESSED', 'DEAD_LETTER')
              AND NOT (
                    (status IN ('PENDING', 'RETRYABLE') AND available_at <= ?)
                    OR (status = 'PROCESSING' AND lease_expires_at <= ?)
              )
        )
        SELECT %s
        FROM sync_outbox_events event
        CROSS JOIN first_blocked
        WHERE event."cursor" > ?
          AND event.entity_classification = ?
          AND event."cursor" < first_blocked.blocked_cursor
          AND (
                (event.status IN ('PENDING', 'RETRYABLE') AND event.available_at <= ?)
                OR (event.status = 'PROCESSING' AND event.lease_expires_at <= ?)
          )
        ORDER BY event."cursor"
        LIMIT ?
        FOR UPDATE
        """.formatted(SELECT_COLUMNS);

    private static final String CLAIM_EVENT = """
        UPDATE sync_outbox_events
        SET status = ?,
            attempt_count = ?,
            lease_token = ?,
            claimed_at = ?,
            lease_expires_at = ?,
            worker_id = ?,
            updated_at = ?
        WHERE event_id = ?
          AND "cursor" = ?
          AND status = ?
          AND lease_token IS NOT DISTINCT FROM ?
          AND lease_expires_at IS NOT DISTINCT FROM ?
        """;

    private static final String HAS_MORE_CLAIMABLE_EVENTS = """
        SELECT EXISTS (
            SELECT 1
            FROM sync_outbox_events
            WHERE "cursor" > ?
              AND (
                    (status IN ('PENDING', 'RETRYABLE') AND available_at <= ?)
                    OR (status = 'PROCESSING' AND lease_expires_at <= ?)
              )
        )
        """;

    private static final String HAS_MORE_CLINICAL_EVENTS = """
        SELECT EXISTS (
            SELECT 1
            FROM sync_outbox_events
            WHERE "cursor" > ?
              AND entity_classification = ?
              AND (
                    (status IN ('PENDING', 'RETRYABLE') AND available_at <= ?)
                    OR (status = 'PROCESSING' AND lease_expires_at <= ?)
              )
        )
        """;

    private static final String ACKNOWLEDGE_EVENT = """
        UPDATE sync_outbox_events
        SET status = 'PROCESSED',
            lease_token = NULL,
            lease_expires_at = NULL,
            worker_id = NULL,
            acknowledged_at = ?,
            available_at = ?,
            updated_at = ?
        WHERE event_id = ?
          AND status = 'PROCESSING'
          AND lease_token = ?
          AND lease_expires_at >= ?
        """;

    private static final String RETRY_EVENT = """
        UPDATE sync_outbox_events
        SET status = CASE WHEN attempt_count >= ? THEN 'DEAD_LETTER' ELSE 'RETRYABLE' END,
            available_at = CASE WHEN attempt_count >= ? THEN ? ELSE ? END,
            lease_token = NULL,
            lease_expires_at = NULL,
            worker_id = NULL,
            updated_at = ?
        WHERE event_id = ?
          AND status = 'PROCESSING'
          AND lease_token = ?
          AND lease_expires_at >= ?
        """;

    private static final RowMapper<SyncOutboxEvent> ROW_MAPPER = JdbcSyncOutboxAdapter::mapRow;

    private final JdbcTemplate jdbcTemplate;

    public JdbcSyncOutboxAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "jdbcTemplate");
    }

    /**
     * Append must join the authoritative Spring mutation transaction. The
     * mandatory propagation prevents an event from being committed when the
     * source mutation later rolls back.
     */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public SyncAppendResult append(SyncOutboxEvent event) {
        Objects.requireNonNull(event, "event");
        if (event.cursor() != 0) {
            throw new IllegalArgumentException("new outbox events must not carry a persisted cursor");
        }

        SyncOutboxEvent byId = selectByEventId(event.eventId());
        if (byId != null) {
            return reconcile(byId, event);
        }

        SyncOutboxEvent latest = selectLatestForEntity(event.identity());
        SyncAppendDecision decision = SyncOutboxContract.reconcile(latest, event);
        if (decision != SyncAppendDecision.ACCEPTED) {
            return new SyncAppendResult(decision, requireExisting(latest));
        }

        List<SyncOutboxEvent> inserted = jdbcTemplate.query(
            INSERT_EVENT,
            ROW_MAPPER,
            event.eventId(),
            event.identity().entity().classification().name(),
            event.identity().entity().entityType(),
            event.identity().entity().entityId(),
            event.identity().revision(),
            event.identity().operation().name(),
            event.contentHash().value(),
            event.sourceRevision(),
            event.eligibilityRevision(),
            event.occurredAt(),
            event.correlationId(),
            event.availableAt(),
            event.occurredAt()
        );
        if (!inserted.isEmpty()) {
            return new SyncAppendResult(SyncAppendDecision.ACCEPTED, inserted.get(0));
        }

        // Another transaction won a uniqueness race between the read and the
        // insert. Re-read under the current transaction and apply the same
        // pure contract instead of treating a replay as an infrastructure
        // error or inserting a duplicate.
        SyncOutboxEvent concurrent = selectByEventId(event.eventId());
        if (concurrent == null) {
            concurrent = selectLatestForEntity(event.identity());
        }
        if (concurrent == null) {
            throw new IllegalStateException("outbox insert conflict could not be reconciled");
        }
        return reconcile(concurrent, event);
    }

    @Override
    @Transactional
    public SyncBatch claimBatch(
        SyncCursor after,
        int limit,
        UUID workerId,
        Duration lease,
        OffsetDateTime now
    ) {
        return claimBatchInternal(after, limit, workerId, lease, now, null);
    }

    @Override
    @Transactional
    public SyncBatch claimBatchForClassification(
        SyncCursor after,
        int limit,
        UUID workerId,
        Duration lease,
        OffsetDateTime now,
        SyncDataClassification classification
    ) {
        return claimBatchInternal(
            after,
            limit,
            workerId,
            lease,
            now,
            Objects.requireNonNull(classification, "classification")
        );
    }

    private SyncBatch claimBatchInternal(
        SyncCursor after,
        int limit,
        UUID workerId,
        Duration lease,
        OffsetDateTime now,
        SyncDataClassification classification
    ) {
        SyncCursor requestedAfter = Objects.requireNonNull(after, "after");
        UUID owner = Objects.requireNonNull(workerId, "workerId");
        SyncOutboxContract.validateBatchLimit(limit);
        SyncOutboxContract.validateLease(lease);
        OffsetDateTime claimedAt = utc(now, "now");
        OffsetDateTime leaseExpiresAt = claimedAt.plus(lease);
        UUID claimToken = UUID.randomUUID();

        String claimSql = classification == null
            ? SELECT_CLAIMABLE_EVENTS
            : SELECT_CLAIMABLE_CLINICAL_EVENTS;
        Object[] claimArgs = classification == null
            ? new Object[] {
                requestedAfter.value(), claimedAt, claimedAt,
                requestedAfter.value(), claimedAt, claimedAt, limit
            }
            : new Object[] {
                requestedAfter.value(), classification.name(), claimedAt, claimedAt,
                requestedAfter.value(), classification.name(), claimedAt, claimedAt, limit
            };
        List<SyncOutboxEvent> candidates = jdbcTemplate.query(
            claimSql,
            ROW_MAPPER,
            claimArgs
        );
        if (candidates.isEmpty()) {
            return SyncBatch.empty(claimToken, owner, requestedAfter, leaseExpiresAt);
        }

        List<SyncOutboxEvent> claimedEvents = candidates.stream()
            .map(event -> claim(event, claimToken, owner, claimedAt, lease, leaseExpiresAt))
            .toList();
        SyncCursor nextCursor = new SyncCursor(
            claimedEvents.get(claimedEvents.size() - 1).cursor()
        );
        String hasMoreSql = classification == null
            ? HAS_MORE_CLAIMABLE_EVENTS
            : HAS_MORE_CLINICAL_EVENTS;
        Object[] hasMoreArgs = classification == null
            ? new Object[] { nextCursor.value(), claimedAt, claimedAt }
            : new Object[] { nextCursor.value(), classification.name(), claimedAt, claimedAt };
        boolean hasMore = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            hasMoreSql,
            Boolean.class,
            hasMoreArgs
        ));
        return new SyncBatch(
            claimToken,
            owner,
            SyncBatchStatus.CLAIMED,
            requestedAfter,
            nextCursor,
            claimedEvents,
            hasMore,
            leaseExpiresAt
        );
    }

    @Override
    @Transactional
    public void acknowledge(UUID eventId, UUID claimToken, OffsetDateTime acknowledgedAt) {
        UUID id = Objects.requireNonNull(eventId, "eventId");
        UUID token = Objects.requireNonNull(claimToken, "claimToken");
        OffsetDateTime now = utc(acknowledgedAt, "acknowledgedAt");
        int updated = jdbcTemplate.update(
            ACKNOWLEDGE_EVENT,
            now,
            now,
            now,
            id,
            token,
            now
        );
        if (updated != 1) {
            throw new IllegalStateException("worker does not own an active event lease");
        }
    }

    @Override
    @Transactional
    public void retryOrDeadLetter(
        UUID eventId,
        UUID claimToken,
        OffsetDateTime now,
        OffsetDateTime retryAt,
        int maxAttempts
    ) {
        UUID id = Objects.requireNonNull(eventId, "eventId");
        UUID token = Objects.requireNonNull(claimToken, "claimToken");
        OffsetDateTime failedAt = utc(now, "now");
        OffsetDateTime nextAttemptAt = utc(retryAt, "retryAt");
        if (maxAttempts < 1 || maxAttempts > 1_000) {
            throw new IllegalArgumentException("maxAttempts must be between 1 and 1000");
        }
        if (nextAttemptAt.isBefore(failedAt)) {
            throw new IllegalArgumentException("retryAt cannot be before now");
        }

        int updated = jdbcTemplate.update(
            RETRY_EVENT,
            maxAttempts,
            maxAttempts,
            failedAt,
            nextAttemptAt,
            failedAt,
            id,
            token,
            failedAt
        );
        if (updated != 1) {
            throw new IllegalStateException("worker does not own an active event lease");
        }
    }

    private SyncOutboxEvent claim(
        SyncOutboxEvent event,
        UUID claimToken,
        UUID workerId,
        OffsetDateTime claimedAt,
        Duration lease,
        OffsetDateTime leaseExpiresAt
    ) {
        SyncOutboxEvent claimed = event.claim(claimToken, claimedAt, lease);
        int updated = jdbcTemplate.update(
            CLAIM_EVENT,
            claimed.status().name(),
            claimed.attemptCount(),
            claimToken,
            claimedAt,
            leaseExpiresAt,
            workerId,
            claimedAt,
            event.eventId(),
            event.cursor(),
            event.status().name(),
            event.leaseToken(),
            event.leaseExpiresAt()
        );
        if (updated != 1) {
            throw new IllegalStateException("outbox event changed while it was being claimed");
        }
        return claimed;
    }

    private SyncAppendResult reconcile(SyncOutboxEvent existing, SyncOutboxEvent incoming) {
        SyncAppendDecision decision = SyncOutboxContract.reconcile(existing, incoming);
        return new SyncAppendResult(decision, existing);
    }

    private SyncOutboxEvent requireExisting(SyncOutboxEvent existing) {
        if (existing == null) {
            throw new IllegalStateException("outbox reconciliation requires an existing event");
        }
        return existing;
    }

    private SyncOutboxEvent selectByEventId(UUID eventId) {
        List<SyncOutboxEvent> events = jdbcTemplate.query(
            SELECT_BY_EVENT_ID,
            ROW_MAPPER,
            eventId
        );
        return events.isEmpty() ? null : events.get(0);
    }

    private SyncOutboxEvent selectLatestForEntity(SyncEventIdentity identity) {
        List<SyncOutboxEvent> events = jdbcTemplate.query(
            SELECT_LATEST_FOR_ENTITY,
            ROW_MAPPER,
            identity.entity().classification().name(),
            identity.entity().entityType(),
            identity.entity().entityId()
        );
        return events.isEmpty() ? null : events.get(0);
    }

    private static SyncOutboxEvent mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new SyncOutboxEvent(
            readUuid(resultSet, "event_id"),
            resultSet.getLong("cursor_value"),
            new SyncEventIdentity(
                new SyncEntityReference(
                    SyncDataClassification.valueOf(resultSet.getString("entity_classification")),
                    resultSet.getString("entity_type"),
                    readUuid(resultSet, "entity_id")
                ),
                resultSet.getLong("revision"),
                SyncOperation.valueOf(resultSet.getString("operation"))
            ),
            new SyncContentHash(resultSet.getString("content_hash")),
            requiredTimestamp(resultSet, "occurred_at"),
            readUuid(resultSet, "correlation_id"),
            SyncOutboxStatus.valueOf(resultSet.getString("status")),
            resultSet.getInt("attempt_count"),
            nullableUuid(resultSet, "lease_token"),
            nullableTimestamp(resultSet, "lease_expires_at"),
            requiredTimestamp(resultSet, "available_at"),
            nullableLong(resultSet, "source_revision"),
            nullableLong(resultSet, "eligibility_revision")
        );
    }

    private static Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private static UUID readUuid(ResultSet resultSet, String column) throws SQLException {
        Object value = resultSet.getObject(column);
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof String string) {
            return UUID.fromString(string);
        }
        throw new SQLException("required UUID column is missing: " + column);
    }

    private static UUID nullableUuid(ResultSet resultSet, String column) throws SQLException {
        Object value = resultSet.getObject(column);
        if (value == null) {
            return null;
        }
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof String string) {
            return UUID.fromString(string);
        }
        throw new SQLException("UUID column has an unsupported value: " + column);
    }

    private static OffsetDateTime requiredTimestamp(ResultSet resultSet, String column) throws SQLException {
        OffsetDateTime value = nullableTimestamp(resultSet, column);
        if (value == null) {
            throw new SQLException("required timestamp column is missing: " + column);
        }
        return value;
    }

    private static OffsetDateTime nullableTimestamp(ResultSet resultSet, String column) throws SQLException {
        Object value = resultSet.getObject(column);
        if (value == null) {
            return null;
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.withOffsetSameInstant(ZoneOffset.UTC);
        }
        if (value instanceof Instant instant) {
            return instant.atOffset(ZoneOffset.UTC);
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().atOffset(ZoneOffset.UTC);
        }
        throw new SQLException("timestamp column has an unsupported value: " + column);
    }

    private static OffsetDateTime utc(OffsetDateTime value, String field) {
        return Objects.requireNonNull(value, field).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
