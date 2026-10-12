-- Direct credential rotation records only actor, target and event; never secrets.
ALTER TABLE clinical_access_audit DROP CONSTRAINT ck_clinical_access_audit_action;
ALTER TABLE clinical_access_audit ADD CONSTRAINT ck_clinical_access_audit_action
    CHECK (action IN (
        'READ', 'DOWNLOAD', 'PRESCRIBE', 'ADMIN_CANCEL_APPOINTMENT',
        'GENERATE', 'REVOKE', 'ADMIN_UPDATE_USER_STATUS', 'ADMIN_UPDATE_USER_ROLES',
        'ADMIN_UPDATE_USER_PASSWORD'
    ));
