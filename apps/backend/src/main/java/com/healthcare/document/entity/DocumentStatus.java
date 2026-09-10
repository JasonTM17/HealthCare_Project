package com.healthcare.document.entity;

/**
 * Document lifecycle states per ADR-005. MVP generation is synchronous, so a
 * row reaches AVAILABLE before the API responds; PENDING is reserved for the
 * future async queue. REVOKED and SUPERSEDED rows stay listed but deny
 * downloads.
 */
public enum DocumentStatus {
    PENDING,
    AVAILABLE,
    FAILED,
    SUPERSEDED,
    REVOKED
}
