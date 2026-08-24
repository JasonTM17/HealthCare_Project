package com.healthcare.sync.outbox;

import com.healthcare.TestcontainersIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JdbcSyncOutboxAdapterIntegrationTest extends TestcontainersIntegrationTest {

    private static final UUID ENTITY_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID WORKER_ONE = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID WORKER_TWO = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @Autowired
    private SyncOutboxPort outbox;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void clearOutbox() {
        jdbcTemplate.update("DELETE FROM sync_outbox_events");
    }

    @Test
    void appendClaimRejectWrongOwnerAcknowledgeAndReplay() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        SyncOutboxEvent event = pending(1, "catalog-v1");

        SyncAppendResult accepted = appendInTransaction(event);
        assertThat(accepted.decision()).isEqualTo(SyncAppendDecision.ACCEPTED);
        assertThat(accepted.event().cursor()).isPositive();

        SyncAppendResult replay = appendInTransaction(pending(1, "catalog-v1"));
        assertThat(replay.decision()).isEqualTo(SyncAppendDecision.IDEMPOTENT_REPLAY);
        assertThat(replay.event().eventId()).isEqualTo(accepted.event().eventId());

        SyncBatch batch = outbox.claimBatch(
            SyncCursor.INITIAL,
            10,
            WORKER_ONE,
            java.time.Duration.ofMinutes(5),
            now.plusSeconds(1)
        );
        assertThat(batch.events()).hasSize(1);
        assertThat(batch.events().get(0).status()).isEqualTo(SyncOutboxStatus.PROCESSING);

        assertThatThrownBy(() -> outbox.acknowledge(
            event.eventId(),
            WORKER_TWO,
            now.plusSeconds(2)
        )).isInstanceOf(RuntimeException.class)
            .hasMessageContaining("active event lease");

        outbox.acknowledge(event.eventId(), batch.claimToken(), now.plusSeconds(2));
        assertThat(jdbcTemplate.queryForObject(
            "SELECT status FROM sync_outbox_events WHERE event_id = ?",
            String.class,
            event.eventId()
        )).isEqualTo("PROCESSED");
    }

    @Test
    void retryMovesEventToDeadLetterAtAttemptLimit() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        SyncOutboxEvent event = pending(2, "catalog-v2");
        appendInTransaction(event);

        SyncBatch batch = outbox.claimBatch(
            SyncCursor.INITIAL,
            10,
            WORKER_ONE,
            java.time.Duration.ofMinutes(5),
            now.plusSeconds(1)
        );

        outbox.retryOrDeadLetter(
            event.eventId(),
            batch.claimToken(),
            now.plusSeconds(2),
            now.plusSeconds(30),
            1
        );

        assertThat(jdbcTemplate.queryForObject(
            "SELECT status FROM sync_outbox_events WHERE event_id = ?",
            String.class,
            event.eventId()
        )).isEqualTo("DEAD_LETTER");
    }

    @Test
    void clinicalEventPersistsSourceAndEligibilityRevisions() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        SyncOutboxEvent event = SyncOutboxEvent.pending(
            new SyncEventIdentity(
                new SyncEntityReference(
                    SyncDataClassification.DEIDENTIFIED_CLINICAL,
                    "specialty",
                    ENTITY_ID
                ),
                9,
                SyncOperation.UPSERT
            ),
            SyncContentHash.sha256("clinical-v9"),
            now,
            UUID.randomUUID(),
            4,
            9
        );

        appendInTransaction(event);

        Map<String, Object> row = jdbcTemplate.queryForMap(
            "SELECT source_revision, eligibility_revision FROM sync_outbox_events WHERE event_id = ?",
            event.eventId()
        );
        assertThat(((Number) row.get("source_revision")).longValue()).isEqualTo(4);
        assertThat(((Number) row.get("eligibility_revision")).longValue()).isEqualTo(9);
    }

    private SyncAppendResult appendInTransaction(SyncOutboxEvent event) {
        SyncAppendResult result = transactionTemplate.execute(status -> outbox.append(event));
        assertThat(result).isNotNull();
        return result;
    }

    private SyncOutboxEvent pending(long revision, String content) {
        SyncEntityReference entity = new SyncEntityReference(
            SyncDataClassification.PUBLIC_CATALOG,
            "specialty",
            ENTITY_ID
        );
        return SyncOutboxEvent.pending(
            new SyncEventIdentity(entity, revision, SyncOperation.UPSERT),
            SyncContentHash.sha256(content),
            OffsetDateTime.now(ZoneOffset.UTC),
            UUID.randomUUID()
        );
    }
}
