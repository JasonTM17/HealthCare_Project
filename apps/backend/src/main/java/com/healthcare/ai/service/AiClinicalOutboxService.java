package com.healthcare.ai.service;

import com.healthcare.sync.outbox.SyncAppendDecision;
import com.healthcare.sync.outbox.SyncDataClassification;
import com.healthcare.sync.outbox.SyncEntityReference;
import com.healthcare.sync.outbox.SyncEventIdentity;
import com.healthcare.sync.outbox.SyncOperation;
import com.healthcare.sync.outbox.SyncOutboxEvent;
import com.healthcare.sync.outbox.SyncOutboxPort;
import com.healthcare.sync.outbox.SyncContentHash;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * Appends metadata-only governed clinical events in the owning catalog/review
 * transaction.  The event revision is the database-owned eligibility revision;
 * the immutable source revision remains carried as a column by the additive
 * migration and is never used as a client-controlled ordering key.
 */
@Service
public class AiClinicalOutboxService {

    private final SyncOutboxPort outbox;

    public AiClinicalOutboxService(SyncOutboxPort outbox) {
        this.outbox = Objects.requireNonNull(outbox, "outbox");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public SyncAppendDecision append(
            String sourceType,
            UUID sourceId,
            long sourceRevision,
            long eligibilityRevision,
            String contentHash,
            String operation) {
        String normalizedType = normalizeType(sourceType);
        String normalizedOperation = operation == null
            ? ""
            : operation.trim().toUpperCase(Locale.ROOT);
        SyncOperation syncOperation;
        try {
            syncOperation = SyncOperation.valueOf(normalizedOperation);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("unsupported clinical outbox operation", exception);
        }
        if (sourceId == null || sourceRevision <= 0 || eligibilityRevision <= 0) {
            throw new IllegalArgumentException("clinical outbox identity revisions are required");
        }

        SyncEventIdentity identity = new SyncEventIdentity(
            new SyncEntityReference(
                SyncDataClassification.DEIDENTIFIED_CLINICAL,
                normalizedType.toLowerCase(Locale.ROOT),
                sourceId
            ),
            eligibilityRevision,
            syncOperation
        );
        SyncOutboxEvent event = SyncOutboxEvent.pending(
            identity,
            new SyncContentHash(contentHash),
            java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC),
            java.util.UUID.randomUUID(),
            sourceRevision,
            eligibilityRevision
        );
        SyncAppendDecision decision = outbox.append(event).decision();
        if (decision == SyncAppendDecision.CONFLICT) {
            throw new IllegalStateException("clinical outbox equal-revision conflict");
        }
        return decision;
    }

    private String normalizeType(String sourceType) {
        String normalized = sourceType == null ? "" : sourceType.trim().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("SPECIALTY", "ARTICLE", "FAQ").contains(normalized)) {
            throw new IllegalArgumentException("unsupported clinical outbox source type");
        }
        return normalized;
    }
}
