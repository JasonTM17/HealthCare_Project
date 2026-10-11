-- Additive recovery provenance. Existing document identities/history stay intact.
ALTER TABLE patient_documents
    ADD COLUMN regenerated_from_document_id UUID REFERENCES patient_documents(id),
    ADD COLUMN source_snapshot_sha256 VARCHAR(64),
    ADD COLUMN recovery_reason VARCHAR(40);

ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_recovery_lineage_check CHECK (
    (regenerated_from_document_id IS NULL AND source_snapshot_sha256 IS NULL AND recovery_reason IS NULL)
    OR (regenerated_from_document_id IS NOT NULL AND regenerated_from_document_id <> id
        AND source_snapshot_sha256 IS NOT NULL AND recovery_reason IS NOT NULL
        AND source_snapshot_sha256 ~ '^[0-9a-f]{64}$'
        AND recovery_reason = 'LOST_FILE_COPY')
);
CREATE INDEX patient_documents_recovery_parent_idx ON patient_documents(regenerated_from_document_id)
    WHERE regenerated_from_document_id IS NOT NULL;
