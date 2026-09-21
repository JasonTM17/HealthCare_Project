-- An administrator cancelling a live appointment is a high-impact action taken
-- on behalf of the patient, so it must leave the same append-only evidence as a
-- clinical read. The V52/V77/V75 CHECK constraints only allowed artifact target
-- types (MEDICAL_RECORD / PRESCRIPTION / DIAGNOSTIC / FILE / DOCUMENT) and the
-- actions READ / DOWNLOAD / PRESCRIBE, so an appointment-targeted
-- ADMIN_CANCEL_APPOINTMENT row could not be inserted at all.
-- Same repair pattern as V75 and V77: widen the two CHECK constraints.

ALTER TABLE clinical_access_audit DROP CONSTRAINT IF EXISTS ck_clinical_access_audit_target_type;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_target_type
        CHECK (target_type IN ('MEDICAL_RECORD', 'PRESCRIPTION', 'DIAGNOSTIC', 'FILE', 'DOCUMENT', 'APPOINTMENT'));

ALTER TABLE clinical_access_audit DROP CONSTRAINT IF EXISTS ck_clinical_access_audit_action;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_action
        CHECK (action IN ('READ', 'DOWNLOAD', 'PRESCRIBE', 'ADMIN_CANCEL_APPOINTMENT'));
