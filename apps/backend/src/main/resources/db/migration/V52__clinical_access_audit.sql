-- Append-only clinical access evidence. Rows identify the actor, patient,
-- artifact type/id, action, and allow/deny decision. They must not duplicate
-- diagnosis, notes, prescription lines, or file bytes.

CREATE TABLE clinical_access_audit (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id UUID,
    actor_email VARCHAR(320) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    patient_id UUID,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    action VARCHAR(32) NOT NULL,
    decision VARCHAR(16) NOT NULL,
    CONSTRAINT ck_clinical_access_audit_target_type
        CHECK (target_type IN ('MEDICAL_RECORD', 'PRESCRIPTION', 'DIAGNOSTIC', 'FILE')),
    CONSTRAINT ck_clinical_access_audit_action
        CHECK (action IN ('READ', 'DOWNLOAD')),
    CONSTRAINT ck_clinical_access_audit_decision
        CHECK (decision IN ('ALLOW', 'DENY'))
);

CREATE INDEX idx_clinical_access_audit_patient_occurred
    ON clinical_access_audit (patient_id, occurred_at DESC);

CREATE INDEX idx_clinical_access_audit_actor_occurred
    ON clinical_access_audit (actor_user_id, occurred_at DESC);
