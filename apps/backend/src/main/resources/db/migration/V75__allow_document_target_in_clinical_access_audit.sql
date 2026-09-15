-- Document flows record clinical-audit rows with TARGET 'DOCUMENT'
-- (DocumentService.TARGET_DOCUMENT), but the V52 CHECK constraint only
-- allowed MEDICAL_RECORD / PRESCRIPTION / DIAGNOSTIC / FILE. Every audited
-- document action — including the plain document list — therefore violated
-- the constraint and surfaced as HTTP 409.
ALTER TABLE clinical_access_audit DROP CONSTRAINT ck_clinical_access_audit_target_type;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_target_type
        CHECK (target_type IN ('MEDICAL_RECORD', 'PRESCRIPTION', 'DIAGNOSTIC', 'FILE', 'DOCUMENT'));
