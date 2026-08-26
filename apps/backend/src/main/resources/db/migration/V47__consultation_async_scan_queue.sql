-- Additive queue timing for the trusted background scanner. Existing upload
-- intents are not treated as completed uploads; the browser must HEAD-ack them.
ALTER TABLE patient_consultation_attachments
    ADD COLUMN scan_available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_consultation_attachment_scan_queue
    ON patient_consultation_attachments(scan_available_at, created_at, id)
    WHERE scan_status = 'PENDING' AND upload_status = 'UPLOADED';

COMMENT ON COLUMN patient_consultation_attachments.scan_available_at IS
    'Database-time retry schedule. Only a trusted leased worker can persist a CLEAN scan result.';
