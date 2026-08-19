CREATE TABLE stored_files (
    id UUID PRIMARY KEY,
    object_key VARCHAR(255) NOT NULL UNIQUE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_id UUID REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(150) NOT NULL,
    size_bytes BIGINT NOT NULL,
    purpose VARCHAR(40) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_stored_file_size CHECK (size_bytes > 0),
    CONSTRAINT ck_stored_file_purpose CHECK (
        purpose IN ('GENERAL', 'CLINICAL_NOTE', 'DIAGNOSTIC_RESULT', 'PRESCRIPTION', 'PATIENT_DOCUMENT')
    )
);

CREATE INDEX idx_stored_files_patient_created
    ON stored_files(patient_id, created_at DESC)
    WHERE patient_id IS NOT NULL;
CREATE INDEX idx_stored_files_uploader_created
    ON stored_files(uploader_id, created_at DESC);

ALTER TABLE diagnostic_results
    ADD COLUMN stored_file_id UUID,
    ADD CONSTRAINT fk_diagnostic_results_stored_file
        FOREIGN KEY (stored_file_id) REFERENCES stored_files(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_diagnostic_results_stored_file
    ON diagnostic_results(stored_file_id)
    WHERE stored_file_id IS NOT NULL;
