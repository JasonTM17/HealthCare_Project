-- Admin user-governance actions (account disable/enable and role rewrites on
-- /api/v1/admin/users/**) write append-only rows to clinical_access_audit.
-- Widen both CHECK constraints: 'USER' target plus the two new actions.
ALTER TABLE clinical_access_audit DROP CONSTRAINT IF EXISTS ck_clinical_access_audit_target_type;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_target_type
        CHECK (target_type IN ('MEDICAL_RECORD', 'PRESCRIPTION', 'DIAGNOSTIC', 'FILE', 'DOCUMENT', 'APPOINTMENT', 'USER'));

ALTER TABLE clinical_access_audit DROP CONSTRAINT IF EXISTS ck_clinical_access_audit_action;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_action
        CHECK (action IN (
            'READ', 'DOWNLOAD', 'PRESCRIBE', 'ADMIN_CANCEL_APPOINTMENT',
            'GENERATE', 'REVOKE',
            'ADMIN_UPDATE_USER_STATUS', 'ADMIN_UPDATE_USER_ROLES'
        ));
