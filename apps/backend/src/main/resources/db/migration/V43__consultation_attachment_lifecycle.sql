-- Consultation attachment lifecycle authority.
--
-- V37 already stores the server-owned private object key, the observed MIME
-- type and the AV result.  This migration is deliberately additive: existing
-- rows remain readable and their observed MIME is used as the initial declared
-- value.  Upload/scan workers may advance lifecycle fields, while browser
-- requests never choose an object key or a CLEAN result.

ALTER TABLE patient_consultation_attachments
    ADD COLUMN IF NOT EXISTS declared_mime_type VARCHAR(120),
    ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS scan_lease_token UUID,
    ADD COLUMN IF NOT EXISTS scan_lease_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS scan_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejection_code VARCHAR(64);

UPDATE patient_consultation_attachments
   SET declared_mime_type = actual_mime_type
 WHERE declared_mime_type IS NULL;

-- Existing metadata rows have already completed the upload protocol.  Keep
-- their previous AV state while giving new rows an explicit REQUESTED state.
UPDATE patient_consultation_attachments
   SET upload_status = CASE
       WHEN scan_status = 'REJECTED' THEN 'REJECTED'
       WHEN scan_status = 'CLEAN' THEN 'UPLOADED'
       ELSE 'REQUESTED'
   END
 WHERE upload_status = 'REQUESTED';

ALTER TABLE patient_consultation_attachments
    ALTER COLUMN declared_mime_type SET NOT NULL;

-- The V37 column represented the client-declared type and was NOT NULL.  From
-- V43 onward the observed type is unknown until the trusted worker has HEADed,
-- hashed and MIME-sniffed the object, so it must remain nullable while the
-- attachment is quarantined.
ALTER TABLE patient_consultation_attachments
    ALTER COLUMN actual_mime_type DROP NOT NULL;

ALTER TABLE patient_consultation_attachments
    DROP CONSTRAINT IF EXISTS ck_patient_consultation_attachment_mime;

ALTER TABLE patient_consultation_attachments
    ADD CONSTRAINT ck_patient_consultation_attachment_mime
        CHECK (actual_mime_type IS NULL OR actual_mime_type IN ('image/jpeg', 'image/png', 'application/pdf'));

ALTER TABLE patient_consultation_attachments
    ADD CONSTRAINT ck_patient_consultation_attachment_declared_mime
        CHECK (declared_mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
    ADD CONSTRAINT ck_patient_consultation_attachment_upload_status
        CHECK (upload_status IN ('REQUESTED', 'UPLOADING', 'UPLOADED', 'EXPIRED', 'REJECTED')),
    ADD CONSTRAINT ck_patient_consultation_attachment_scan_attempts
        CHECK (scan_attempts >= 0 AND scan_attempts <= 20),
    ADD CONSTRAINT ck_patient_consultation_attachment_scan_lease_pair
        CHECK ((scan_lease_token IS NULL) = (scan_lease_expires_at IS NULL)),
    ADD CONSTRAINT ck_patient_consultation_attachment_rejection_code
        CHECK (rejection_code IS NULL OR rejection_code ~ '^[A-Z0-9_-]{1,64}$'),
    ADD CONSTRAINT ck_patient_consultation_attachment_upload_dates
        CHECK (uploaded_at IS NULL OR upload_expires_at IS NULL OR uploaded_at <= upload_expires_at);

CREATE INDEX idx_patient_consultation_attachments_upload_expiry
    ON patient_consultation_attachments(upload_expires_at, id)
    WHERE upload_status IN ('REQUESTED', 'UPLOADING');

CREATE INDEX idx_patient_consultation_attachments_scan_lease
    ON patient_consultation_attachments(scan_lease_expires_at, id)
    WHERE scan_status = 'PENDING';

COMMENT ON COLUMN patient_consultation_attachments.declared_mime_type IS
    'Client declaration used only for upload validation; actual_mime_type is worker-observed authority.';
COMMENT ON COLUMN patient_consultation_attachments.upload_status IS
    'Database lifecycle: REQUESTED, UPLOADING, UPLOADED, EXPIRED or REJECTED.';
COMMENT ON COLUMN patient_consultation_attachments.scan_lease_token IS
    'Opaque worker lease token; browser callers cannot claim or complete a scan.';
