package com.healthcare.ai;

import com.healthcare.ai.service.AiClinicalOutboxWorker;
import com.healthcare.ai.service.AiClinicalProjectionIndexService;
import com.healthcare.sync.outbox.SyncBatch;
import com.healthcare.sync.outbox.SyncContentHash;
import com.healthcare.sync.outbox.SyncDataClassification;
import com.healthcare.sync.outbox.SyncCursor;
import com.healthcare.sync.outbox.SyncEntityReference;
import com.healthcare.sync.outbox.SyncEventIdentity;
import com.healthcare.sync.outbox.SyncOperation;
import com.healthcare.sync.outbox.SyncOutboxEvent;
import com.healthcare.sync.outbox.SyncOutboxPort;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AiClinicalOutboxWorkerTest {

    private static final OffsetDateTime NOW = OffsetDateTime.ofInstant(
        Instant.parse("2026-08-24T08:00:00Z"), ZoneOffset.UTC
    );

    @Test
    void acknowledgesOnlyAfterClassificationScopedProjectionConverges() {
        SyncOutboxPort outbox = mock(SyncOutboxPort.class);
        AiClinicalProjectionIndexService projection = mock(AiClinicalProjectionIndexService.class);
        when(projection.isConfigured()).thenReturn(true);
        SyncBatch batch = claimedBatch();
        when(outbox.claimBatchForClassification(
            any(), anyInt(), any(), any(), any(), eq(SyncDataClassification.DEIDENTIFIED_CLINICAL)
        )).thenReturn(batch);
        when(projection.isEventConverged(any())).thenReturn(true);

        UUID workerId = UUID.randomUUID();
        AiClinicalOutboxWorker worker = new AiClinicalOutboxWorker(
            outbox, projection, Clock.fixed(NOW.toInstant(), ZoneOffset.UTC), workerId
        );

        assertThat(worker.processOnce()).isEqualTo(1);
        verify(projection).synchronizeClinicalNow();
        verify(outbox).acknowledge(batch.events().get(0).eventId(), batch.claimToken(), NOW);
    }

    @Test
    void retriesInsteadOfAcknowledgingWhenProjectionDoesNotMatch() {
        SyncOutboxPort outbox = mock(SyncOutboxPort.class);
        AiClinicalProjectionIndexService projection = mock(AiClinicalProjectionIndexService.class);
        when(projection.isConfigured()).thenReturn(true);
        SyncBatch batch = claimedBatch();
        when(outbox.claimBatchForClassification(
            any(), anyInt(), any(), any(), any(), eq(SyncDataClassification.DEIDENTIFIED_CLINICAL)
        )).thenReturn(batch);
        when(projection.isEventConverged(any())).thenReturn(false);

        AiClinicalOutboxWorker worker = new AiClinicalOutboxWorker(
            outbox, projection, Clock.fixed(NOW.toInstant(), ZoneOffset.UTC), UUID.randomUUID()
        );

        assertThat(worker.processOnce()).isZero();
        verify(outbox).retryOrDeadLetter(
            eq(batch.events().get(0).eventId()), eq(batch.claimToken()), eq(NOW),
            eq(NOW.plusSeconds(30)), anyInt()
        );
    }

    private SyncBatch claimedBatch() {
        UUID sourceId = UUID.randomUUID();
        SyncOutboxEvent pending = SyncOutboxEvent.pending(
            new SyncEventIdentity(
                new SyncEntityReference(
                    SyncDataClassification.DEIDENTIFIED_CLINICAL, "article", sourceId
                ),
                4,
                SyncOperation.UPSERT
            ),
            SyncContentHash.sha256("article-v4"),
            NOW,
            UUID.randomUUID()
        );
        UUID claimToken = UUID.randomUUID();
        SyncOutboxEvent claimed = pending.withCursor(1).claim(claimToken, NOW, Duration.ofMinutes(5));
        return new SyncBatch(
            claimToken,
            UUID.randomUUID(),
            com.healthcare.sync.outbox.SyncBatchStatus.CLAIMED,
            new SyncCursor(0),
            new SyncCursor(1),
            List.of(claimed),
            false,
            NOW.plusMinutes(5)
        );
    }
}
