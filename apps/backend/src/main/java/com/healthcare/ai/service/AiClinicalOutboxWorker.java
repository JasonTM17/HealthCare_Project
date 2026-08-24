package com.healthcare.ai.service;

import com.healthcare.sync.outbox.SyncBatch;
import com.healthcare.sync.outbox.SyncDataClassification;
import com.healthcare.sync.outbox.SyncCursor;
import com.healthcare.sync.outbox.SyncOutboxEvent;
import com.healthcare.sync.outbox.SyncOutboxPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Small, lease-based consumer for governed clinical outbox metadata.  It
 * never trusts an event payload: each claimed event triggers a live
 * database-authoritative reconciliation, then is acknowledged only after the
 * protected AI projection reports the current revision/hash/state.
 */
@Service
public class AiClinicalOutboxWorker {

    private static final Logger log = LoggerFactory.getLogger(AiClinicalOutboxWorker.class);
    private static final Duration DEFAULT_LEASE = Duration.ofMinutes(5);
    private static final Duration RETRY_DELAY = Duration.ofSeconds(30);

    private final SyncOutboxPort outbox;
    private final AiClinicalProjectionIndexService projection;
    private final Clock clock;
    private final UUID workerId;

    @Value("${ai.rag-ingest.outbox-batch-size:50}")
    private int batchSize;

    @Value("${ai.rag-ingest.outbox-max-attempts:8}")
    private int maxAttempts;

    @Autowired
    public AiClinicalOutboxWorker(
            SyncOutboxPort outbox,
            AiClinicalProjectionIndexService projection) {
        this(outbox, projection, Clock.systemUTC(), UUID.randomUUID());
    }

    public AiClinicalOutboxWorker(
            SyncOutboxPort outbox,
            AiClinicalProjectionIndexService projection,
            Clock clock,
            UUID workerId) {
        this.outbox = outbox;
        this.projection = projection;
        this.clock = clock;
        this.workerId = workerId;
    }

    @Scheduled(
        initialDelayString = "${ai.rag-ingest.outbox-initial-delay-ms:25000}",
        fixedDelayString = "${ai.rag-ingest.outbox-poll-delay-ms:15000}"
    )
    public void scheduledPoll() {
        try {
            processOnce();
        } catch (RuntimeException exception) {
            // A lease remains retryable/dead-lettered by processOnce.  Keep the
            // scheduler alive and avoid logging source titles or patient data.
            log.warn("AI clinical outbox poll deferred: {}", exception.getClass().getSimpleName());
        }
    }

    /** Process at most one classification-scoped leased batch. */
    public int processOnce() {
        if (!projection.isConfigured()) return 0;
        int safeBatch = Math.max(1, Math.min(batchSize, 1_000));
        int safeAttempts = Math.max(1, Math.min(maxAttempts, 1_000));
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        SyncBatch batch = outbox.claimBatchForClassification(
            new SyncCursor(0),
            safeBatch,
            workerId,
            DEFAULT_LEASE,
            now,
            SyncDataClassification.DEIDENTIFIED_CLINICAL
        );
        if (batch.events().isEmpty()) return 0;

        try {
            projection.synchronizeClinicalNow();
        } catch (RuntimeException failure) {
            retryAll(batch, now, safeAttempts);
            throw failure;
        }

        int acknowledged = 0;
        for (SyncOutboxEvent event : batch.events()) {
            OffsetDateTime decisionTime = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
            try {
                if (projection.isEventConverged(event)) {
                    outbox.acknowledge(event.eventId(), batch.claimToken(), decisionTime);
                    acknowledged++;
                } else {
                    outbox.retryOrDeadLetter(
                        event.eventId(), batch.claimToken(), decisionTime,
                        decisionTime.plus(RETRY_DELAY), safeAttempts
                    );
                }
            } catch (RuntimeException failure) {
                // A lost lease or a transient projection error must not stop
                // later events in the same batch from being attempted.
                try {
                    outbox.retryOrDeadLetter(
                        event.eventId(), batch.claimToken(), decisionTime,
                        decisionTime.plus(RETRY_DELAY), safeAttempts
                    );
                } catch (RuntimeException ignored) {
                    log.warn("AI clinical outbox lease update deferred: {}", ignored.getClass().getSimpleName());
                }
            }
        }
        return acknowledged;
    }

    private void retryAll(SyncBatch batch, OffsetDateTime now, int safeAttempts) {
        for (SyncOutboxEvent event : batch.events()) {
            try {
                outbox.retryOrDeadLetter(
                    event.eventId(), batch.claimToken(), now,
                    now.plus(RETRY_DELAY), safeAttempts
                );
            } catch (RuntimeException ignored) {
                log.warn("AI clinical outbox retry update deferred: {}", ignored.getClass().getSimpleName());
            }
        }
    }
}
