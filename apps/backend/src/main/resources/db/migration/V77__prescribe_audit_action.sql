-- Prescribing is a clinical act and must leave an append-only audit row, but
-- the V52 action CHECK only allowed READ / DOWNLOAD. Widen it with PRESCRIBE
-- (same repair pattern as V75's target_type widening).

ALTER TABLE clinical_access_audit DROP CONSTRAINT ck_clinical_access_audit_action;

ALTER TABLE clinical_access_audit
    ADD CONSTRAINT ck_clinical_access_audit_action
        CHECK (action IN ('READ', 'DOWNLOAD', 'PRESCRIBE'));
