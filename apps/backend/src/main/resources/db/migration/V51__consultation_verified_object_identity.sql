-- Pre-authorize the immutable verified-object identity before any scanner can
-- promote bytes. This closes the crash window between object creation and the
-- later lease-fenced attachment-row update.
--
-- V43-V50 did not retain the original upload key after a CLEAN promotion, so
-- a non-empty legacy attachment table cannot be upgraded safely without an
-- explicit object inventory. The synthetic beta has no authoritative patient
-- attachments yet; fail closed instead of pretending historical upload keys
-- can be reconstructed.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM patient_consultation_attachments) THEN
        RAISE EXCEPTION
            'V51 requires an empty consultation attachment table or a reviewed pre-migration object inventory';
    END IF;
END $$;

ALTER TABLE patient_consultation_attachments
    ADD COLUMN verified_object_key VARCHAR(512) NOT NULL;

ALTER TABLE patient_consultation_attachments
    ADD CONSTRAINT ck_patient_consultation_attachment_verified_object_key
        CHECK (verified_object_key LIKE 'private/consultations/%/verified/%'
            AND verified_object_key NOT LIKE '%..%'
            AND position(chr(92) in verified_object_key) = 0);

CREATE UNIQUE INDEX uq_patient_consultation_attachments_verified_object_key
    ON patient_consultation_attachments(verified_object_key);

COMMENT ON COLUMN patient_consultation_attachments.verified_object_key IS
    'Deterministic server-owned verified object identity persisted before upload; never supplied by a browser.';
