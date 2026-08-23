package com.healthcare.sync.outbox;

/**
 * Classification carried by a server-owned sync event.
 *
 * <p>The classification is deliberately explicit so a downstream consumer can
 * keep public catalog data separate from de-identified clinical data.</p>
 */
public enum SyncDataClassification {
    PUBLIC_CATALOG,
    DEIDENTIFIED_CLINICAL
}
