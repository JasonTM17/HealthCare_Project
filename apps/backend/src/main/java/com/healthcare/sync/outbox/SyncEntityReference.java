package com.healthcare.sync.outbox;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Server-side entity identity. UUID-only identifiers prevent an event from
 * carrying an email address, phone number, or other client-provided identity.
 */
public record SyncEntityReference(
    SyncDataClassification classification,
    String entityType,
    UUID entityId
) {

    private static final Pattern ENTITY_TYPE = Pattern.compile("[a-z][a-z0-9_]{0,63}");

    public SyncEntityReference {
        classification = Objects.requireNonNull(classification, "classification");
        entityId = Objects.requireNonNull(entityId, "entityId");
        if (entityType == null) {
            throw new IllegalArgumentException("entityType is required");
        }
        entityType = entityType.trim().toLowerCase(Locale.ROOT);
        if (!ENTITY_TYPE.matcher(entityType).matches()) {
            throw new IllegalArgumentException("entityType must be a lower snake-case identifier");
        }
    }
}
