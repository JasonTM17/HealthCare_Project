package com.healthcare.sync.outbox;

import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SyncOutboxContractTest {

    private static final OffsetDateTime NOW = OffsetDateTime.ofInstant(
        Instant.parse("2026-08-23T02:00:00Z"),
        ZoneOffset.UTC
    );
    private static final Clock CLOCK = Clock.fixed(NOW.toInstant(), ZoneOffset.UTC);
    private static final UUID ENTITY_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID WORKER_ONE = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID WORKER_TWO = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private final ServerSyncEventFactory factory = new ServerSyncEventFactory(CLOCK);

    @Test
    void createsServerOwnedMetadataWithoutRetainingSourceContent() {
        String sensitiveContent = "patient@example.test and +84 900 000 000";
        SyncOutboxEvent event = factory.create(
            identity(1, SyncOperation.UPSERT),
            SyncContentHash.sha256(sensitiveContent)
        );

        assertThat(event.eventId()).isNotNull();
        assertThat(event.correlationId()).isNotNull();
        assertThat(event.cursor()).isZero();
        assertThat(event.status()).isEqualTo(SyncOutboxStatus.PENDING);
        assertThat(event.toString()).doesNotContain(sensitiveContent);
        assertThat(List.of(SyncOutboxEvent.class.getRecordComponents()))
            .extracting(RecordComponent::getName)
            .doesNotContain("payload", "content", "email", "phone", "userId");
    }

    @Test
    void hashesCanonicalContentAndBuildsStableIdempotencyKey() {
        assertThat(SyncContentHash.sha256("hello").value())
            .isEqualTo("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");

        SyncOutboxEvent first = factory.create(identity(4, SyncOperation.UPSERT), SyncContentHash.sha256("v4"));
        SyncOutboxEvent second = factory.create(identity(4, SyncOperation.UPSERT), SyncContentHash.sha256("v4"));

        assertThat(first.identity().idempotencyKey())
            .isEqualTo(second.identity().idempotencyKey())
            .contains("public_catalog:specialty:");
        assertThat(first.identity().idempotencyKey()).doesNotContain("patient@example");
    }

    @Test
    void reconcilesReplayConflictAndStaleRevision() {
        SyncOutboxEvent existing = factory.create(identity(3, SyncOperation.UPSERT), SyncContentHash.sha256("v3"));

        SyncOutboxEvent replay = new SyncOutboxEvent(
            existing.eventId(),
            existing.cursor(),
            existing.identity(),
            existing.contentHash(),
            existing.occurredAt(),
            existing.correlationId(),
            existing.status(),
            existing.attemptCount(),
            existing.leaseToken(),
            existing.leaseExpiresAt(),
            existing.availableAt()
        );
        assertThat(SyncOutboxContract.reconcile(existing, replay))
            .isEqualTo(SyncAppendDecision.IDEMPOTENT_REPLAY);

        SyncOutboxEvent sameRevisionDifferentHash = factory.create(
            identity(3, SyncOperation.UPSERT),
            SyncContentHash.sha256("tampered")
        );
        assertThat(SyncOutboxContract.reconcile(existing, sameRevisionDifferentHash))
            .isEqualTo(SyncAppendDecision.CONFLICT);

        SyncOutboxEvent stale = factory.create(identity(2, SyncOperation.UPSERT), SyncContentHash.sha256("v2"));
        assertThat(SyncOutboxContract.reconcile(existing, stale))
            .isEqualTo(SyncAppendDecision.STALE_REVISION);

        SyncOutboxEvent next = factory.create(identity(4, SyncOperation.UPSERT), SyncContentHash.sha256("v4"));
        assertThat(SyncOutboxContract.reconcile(existing, next))
            .isEqualTo(SyncAppendDecision.ACCEPTED);
    }

    @Test
    void leaseOwnershipAndBoundedRetryAreEnforced() {
        SyncOutboxEvent pending = factory.create(identity(1, SyncOperation.UPSERT), SyncContentHash.sha256("v1"))
            .withCursor(10);
        SyncOutboxEvent claimed = pending.claim(WORKER_ONE, NOW, Duration.ofMinutes(5));

        assertThat(claimed.status()).isEqualTo(SyncOutboxStatus.PROCESSING);
        assertThat(claimed.attemptCount()).isEqualTo(1);
        assertThatThrownBy(() -> claimed.acknowledge(WORKER_TWO, NOW.plusSeconds(1)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("active event lease");

        SyncOutboxEvent retryable = claimed.retryOrDeadLetter(
            WORKER_ONE,
            NOW.plusSeconds(1),
            NOW.plusSeconds(30),
            3
        );
        assertThat(retryable.status()).isEqualTo(SyncOutboxStatus.RETRYABLE);
        assertThat(retryable.claim(WORKER_TWO, NOW.plusSeconds(30), Duration.ofMinutes(5)).attemptCount())
            .isEqualTo(2);

        SyncOutboxEvent deadLetter = claimed.retryOrDeadLetter(
            WORKER_ONE,
            NOW.plusSeconds(1),
            NOW.plusSeconds(30),
            1
        );
        assertThat(deadLetter.status()).isEqualTo(SyncOutboxStatus.DEAD_LETTER);
        assertThatThrownBy(() -> deadLetter.claim(WORKER_TWO, NOW.plusMinutes(10), Duration.ofMinutes(5)))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void expiredLeaseCanBeReclaimedButOldWorkerCannotAcknowledge() {
        SyncOutboxEvent claimed = factory.create(identity(1, SyncOperation.UPSERT), SyncContentHash.sha256("v1"))
            .withCursor(8)
            .claim(WORKER_ONE, NOW, Duration.ofMinutes(1));

        OffsetDateTime afterExpiry = NOW.plusMinutes(1);
        SyncOutboxEvent reclaimed = claimed.claim(WORKER_TWO, afterExpiry, Duration.ofMinutes(1));

        assertThat(reclaimed.leaseToken()).isEqualTo(WORKER_TWO);
        assertThat(reclaimed.attemptCount()).isEqualTo(2);
        assertThatThrownBy(() -> reclaimed.acknowledge(WORKER_ONE, afterExpiry))
            .isInstanceOf(IllegalStateException.class);
        assertThat(reclaimed.acknowledge(WORKER_TWO, afterExpiry.plusSeconds(1)).status())
            .isEqualTo(SyncOutboxStatus.PROCESSED);
    }

    @Test
    void validatesCursorOrderedBatchAndLeaseOwnership() {
        UUID claimToken = UUID.fromString("44444444-4444-4444-4444-444444444444");
        SyncOutboxEvent first = factory.create(identity(1, SyncOperation.UPSERT), SyncContentHash.sha256("one"))
            .withCursor(11)
            .claim(claimToken, NOW, Duration.ofMinutes(5));
        SyncOutboxEvent second = factory.create(identity(2, SyncOperation.UPSERT), SyncContentHash.sha256("two"))
            .withCursor(12)
            .claim(claimToken, NOW, Duration.ofMinutes(5));

        SyncBatch batch = new SyncBatch(
            claimToken,
            WORKER_ONE,
            SyncBatchStatus.CLAIMED,
            new SyncCursor(10),
            new SyncCursor(12),
            List.of(first, second),
            true,
            NOW.plusMinutes(5)
        );

        assertThat(batch.events()).containsExactly(first, second);
        assertThat(batch.nextCursor().value()).isEqualTo(12);

        assertThatThrownBy(() -> new SyncBatch(
            claimToken,
            WORKER_ONE,
            SyncBatchStatus.CLAIMED,
            new SyncCursor(10),
            new SyncCursor(12),
            List.of(second, first),
            true,
            NOW.plusMinutes(5)
        )).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("strictly cursor ordered");
    }

    @Test
    void rejectsInvalidBatchAndLeaseBounds() {
        assertThatThrownBy(() -> SyncOutboxContract.validateBatchLimit(0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SyncOutboxContract.validateBatchLimit(1_001))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SyncOutboxContract.validateLease(Duration.ofHours(2)))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SyncCursor(-1))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SyncContentHash("not-a-hash"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private SyncEventIdentity identity(long revision, SyncOperation operation) {
        return new SyncEventIdentity(
            new SyncEntityReference(SyncDataClassification.PUBLIC_CATALOG, "specialty", ENTITY_ID),
            revision,
            operation
        );
    }
}
