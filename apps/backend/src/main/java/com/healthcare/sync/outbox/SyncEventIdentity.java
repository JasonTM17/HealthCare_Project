package com.healthcare.sync.outbox;

import java.util.Objects;
import java.util.Locale;

/**
 * Stable identity used for append idempotency. The content hash remains a
 * separate field so a same-revision content change is detected as a conflict.
 */
public record SyncEventIdentity(
    SyncEntityReference entity,
    long revision,
    SyncOperation operation
) {

    public SyncEventIdentity {
        entity = Objects.requireNonNull(entity, "entity");
        operation = Objects.requireNonNull(operation, "operation");
        if (revision <= 0) {
            throw new IllegalArgumentException("revision must be positive");
        }
    }

    public boolean targetsSameEntity(SyncEventIdentity other) {
        return other != null && entity.equals(other.entity);
    }

    /**
     * Stable key for the database unique constraint. It intentionally contains
     * only server-owned identifiers and bounded metadata.
     */
    public String idempotencyKey() {
        String key = entity.classification().name().toLowerCase(Locale.ROOT)
            + ":" + entity.entityType()
            + ":" + entity.entityId()
            + ":" + revision
            + ":" + operation.name();
        if (key.length() > 128) {
            throw new IllegalStateException("sync idempotency key exceeds storage limit");
        }
        return key;
    }
}
