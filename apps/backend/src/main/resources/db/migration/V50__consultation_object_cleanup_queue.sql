-- DB-authoritative cleanup for every private consultation object.
--
-- A clean scan promotes the uploaded quarantine object to a verified key
-- before the fenced attachment-row update. The quarantine upload identity is
-- retained here; V51 persists the deterministic verified identity before any
-- new promotion so a stale worker or storage outage cannot make it
-- undiscoverable.

ALTER TABLE patient_consultation_attachments
    ADD COLUMN IF NOT EXISTS upload_object_key VARCHAR(512);

UPDATE patient_consultation_attachments
   SET upload_object_key = private_object_key
 WHERE upload_object_key IS NULL;

ALTER TABLE patient_consultation_attachments
    ALTER COLUMN upload_object_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_consultation_attachments_upload_object_key
    ON patient_consultation_attachments(upload_object_key);

CREATE TABLE IF NOT EXISTS patient_consultation_object_cleanup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID,
    attachment_id UUID,
    object_key VARCHAR(512) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_token UUID,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    last_failure_code VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_patient_consultation_object_cleanup_key UNIQUE (object_key),
    CONSTRAINT ck_patient_consultation_object_cleanup_key
        CHECK (object_key LIKE 'private/consultations/%'
            AND object_key NOT LIKE '%..%'
            AND position(chr(92) in object_key) = 0),
    CONSTRAINT ck_patient_consultation_object_cleanup_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    CONSTRAINT ck_patient_consultation_object_cleanup_attempts
        CHECK (attempts >= 0 AND attempts <= 20),
    CONSTRAINT ck_patient_consultation_object_cleanup_lease_pair
        CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);

CREATE INDEX idx_patient_consultation_object_cleanup_due
    ON patient_consultation_object_cleanup(status, next_attempt_at, id)
    WHERE status IN ('PENDING', 'PROCESSING', 'FAILED');

COMMENT ON TABLE patient_consultation_object_cleanup IS
    'Service-only queue for deleting quarantine and verified consultation objects; contains no patient message content.';
