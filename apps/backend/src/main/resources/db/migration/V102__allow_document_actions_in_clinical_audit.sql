-- Document generation and revocation write append-only clinical audit rows.
-- V91 retained the older action list, so these operations fail with a check
-- violation after the document work has started. Keep every existing action
-- and add only the two actions emitted by DocumentService.
ALTER TABLE clinical_access_audit DROP CONSTRAINT ck_clinical_access_audit_action;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_action
        CHECK (action IN (
            'READ', 'DOWNLOAD', 'PRESCRIBE', 'ADMIN_CANCEL_APPOINTMENT',
            'GENERATE', 'REVOKE'
        ));
