-- V71__patient_synthetic_documents.sql
-- Phase 05 (HC-05, D-03): approved synthetic document classes only —
-- VISIT_SUMMARY (bản tổng kết lần khám) and PRESCRIPTION (đơn thuốc).
-- Every row is a synthetic demo export; it is never a legally signed record,
-- a diagnostic, or an accounting receipt.

CREATE TABLE patient_documents (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    source_record_id UUID NOT NULL,
    source_type VARCHAR(30) NOT NULL
        CHECK (source_type IN ('VISIT_SUMMARY', 'PRESCRIPTION')),
    source_version BIGINT NOT NULL,
    template_version VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('PENDING', 'AVAILABLE', 'FAILED', 'SUPERSEDED', 'REVOKED')),
    object_key VARCHAR(512) NOT NULL,
    sha256 VARCHAR(64),
    byte_size BIGINT,
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    -- Idempotency key per ADR-005: source type + record id + source version +
    -- template version. Regeneration with the same key must reuse this row.
    idempotency_key VARCHAR(220) NOT NULL UNIQUE,
    CONSTRAINT patient_documents_object_key_safe
        CHECK (object_key LIKE 'documents/%'
            AND object_key NOT LIKE '%..%'
            AND object_key NOT LIKE '%//%'
            AND position(chr(92) in object_key) = 0),
    CONSTRAINT patient_documents_object_metadata_by_status
        CHECK (
            (status IN ('AVAILABLE', 'SUPERSEDED', 'REVOKED')
                AND sha256 ~ '^[0-9a-f]{64}$'
                AND byte_size > 0)
            OR (status IN ('PENDING', 'FAILED')
                AND sha256 IS NULL
                AND byte_size IS NULL)
        ),
    CONSTRAINT patient_documents_revoked_requires_timestamp
        CHECK ((status IN ('REVOKED', 'SUPERSEDED')) = (revoked_at IS NOT NULL))
);

CREATE INDEX idx_patient_documents_patient_generated
    ON patient_documents (patient_id, generated_at DESC);

CREATE TABLE patient_document_object_cleanup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_key VARCHAR(512) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    lease_token UUID,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    last_failure_code VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_patient_document_object_cleanup_key UNIQUE (object_key),
    CONSTRAINT ck_patient_document_object_cleanup_key
        CHECK (object_key LIKE 'documents/%'
            AND object_key NOT LIKE '%..%'
            AND object_key NOT LIKE '%//%'
            AND position(chr(92) in object_key) = 0),
    CONSTRAINT ck_patient_document_object_cleanup_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    CONSTRAINT ck_patient_document_object_cleanup_attempts
        CHECK (attempts >= 0 AND attempts <= 20),
    CONSTRAINT ck_patient_document_object_cleanup_lease_pair
        CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);

CREATE INDEX idx_patient_document_object_cleanup_due
    ON patient_document_object_cleanup(status, next_attempt_at, id)
    WHERE status IN ('PENDING', 'PROCESSING', 'FAILED');

COMMENT ON TABLE patient_documents IS
    'Synthetic demo PDF exports (visit summary, prescription). Integrity sha256 column is the hash of the PDF bytes; it is provenance metadata, not a digital signature.';

COMMENT ON TABLE patient_document_object_cleanup IS
    'Service-only cleanup queue for generated document objects that may outlive failed database finalization; contains no patient clinical content.';
