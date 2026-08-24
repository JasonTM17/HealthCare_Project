-- Synthetic fixture guard and non-prescribing patient care-plan items.
--
-- The guard is disabled by default and permits only an explicitly allowlisted
-- LOCAL/TEST/STAGING manifest.  Care plans stay in Spring PostgreSQL and hold
-- goals/reminders only; they are not AI treatment content or prescriptions.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patient_profiles
    ADD COLUMN IF NOT EXISTS synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE synthetic_beta_guard (
    guard_id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    environment VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
    manifest_hash VARCHAR(64),
    allowlist_state VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
    row_budget BIGINT NOT NULL DEFAULT 0,
    rows_written BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_synthetic_beta_guard_singleton CHECK (guard_id),
    CONSTRAINT ck_synthetic_beta_guard_environment CHECK (
        environment IN ('LOCAL', 'TEST', 'STAGING')
    ),
    CONSTRAINT ck_synthetic_beta_guard_state CHECK (
        allowlist_state IN ('DISABLED', 'ENABLED', 'EXPIRED')
    ),
    CONSTRAINT ck_synthetic_beta_guard_manifest CHECK (
        manifest_hash IS NULL OR manifest_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_synthetic_beta_guard_budget CHECK (
        row_budget >= 0 AND rows_written >= 0 AND rows_written <= row_budget
    ),
    CONSTRAINT ck_synthetic_beta_guard_enabled_shape CHECK (
        (allowlist_state = 'ENABLED'
            AND manifest_hash IS NOT NULL
            AND expires_at IS NOT NULL)
        OR allowlist_state <> 'ENABLED'
    )
);

INSERT INTO synthetic_beta_guard(
    guard_id, environment, manifest_hash, allowlist_state,
    row_budget, rows_written, expires_at
)
VALUES (TRUE, 'LOCAL', NULL, 'DISABLED', 0, 0, NULL)
ON CONFLICT (guard_id) DO NOTHING;

CREATE TABLE patient_care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    title VARCHAR(240) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'),
    deleted_at TIMESTAMP WITH TIME ZONE,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_care_plan_identity UNIQUE (id, patient_profile_id, appointment_id, doctor_id),
    CONSTRAINT ck_patient_care_plan_title CHECK (
        char_length(btrim(title)) BETWEEN 1 AND 240
    ),
    CONSTRAINT ck_patient_care_plan_status CHECK (
        status IN ('OPEN', 'DONE', 'CANCELLED')
    ),
    CONSTRAINT ck_patient_care_plan_dates CHECK (
        ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at
    ),
    CONSTRAINT ck_patient_care_plan_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '365 days'
        AND (deleted_at IS NULL OR deleted_at >= created_at)
    )
);

CREATE TABLE patient_care_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_plan_id UUID NOT NULL,
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    sequence_number INTEGER NOT NULL,
    goal VARCHAR(1000) NOT NULL,
    reminder VARCHAR(500),
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    due_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'),
    deleted_at TIMESTAMP WITH TIME ZONE,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_care_plan_item_sequence
        UNIQUE (care_plan_id, sequence_number),
    CONSTRAINT fk_patient_care_plan_item_parent
        FOREIGN KEY (care_plan_id, patient_profile_id, appointment_id, doctor_id)
        REFERENCES patient_care_plans(id, patient_profile_id, appointment_id, doctor_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_patient_care_plan_item_sequence CHECK (sequence_number > 0),
    CONSTRAINT ck_patient_care_plan_item_goal CHECK (
        char_length(btrim(goal)) BETWEEN 1 AND 1000
        AND goal !~ '[[:cntrl:]]'
    ),
    CONSTRAINT ck_patient_care_plan_item_reminder CHECK (
        reminder IS NULL OR (char_length(reminder) <= 500 AND reminder !~ '[[:cntrl:]]')
    ),
    CONSTRAINT ck_patient_care_plan_item_status CHECK (
        status IN ('OPEN', 'DONE', 'CANCELLED')
    ),
    CONSTRAINT ck_patient_care_plan_item_completion CHECK (
        (status = 'DONE' AND completed_at IS NOT NULL)
        OR (status <> 'DONE')
    ),
    CONSTRAINT ck_patient_care_plan_item_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '365 days'
        AND (deleted_at IS NULL OR deleted_at >= created_at)
    )
);

CREATE TABLE patient_retention_policies (
    policy_key VARCHAR(48) PRIMARY KEY,
    retention_interval INTERVAL NOT NULL,
    immediate_patient_delete BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_patient_retention_policy_interval CHECK (retention_interval > INTERVAL '0 seconds')
);

INSERT INTO patient_retention_policies(policy_key, retention_interval, description)
VALUES
    ('CONSULTATION_WINDOW', INTERVAL '30 days', 'Maximum appointment consultation window'),
    ('CONSULTATION_CONTENT', INTERVAL '90 days', 'Messages and attachments'),
    ('HEALTH_QA_CONTENT', INTERVAL '90 days', 'Questions, immutable answer revisions and reports'),
    ('CARE_PLAN_CONTENT', INTERVAL '365 days', 'Patient goals and reminders')
ON CONFLICT (policy_key) DO NOTHING;

CREATE FUNCTION synthetic_beta_guard_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_care_plan_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_synthetic_fixture_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    guard_row BOOLEAN;
BEGIN
    IF NEW.synthetic_fixture THEN
        IF TG_OP = 'INSERT' THEN
            NULL;
        ELSIF TG_OP = 'UPDATE' AND NOT OLD.synthetic_fixture THEN
            NULL;
        ELSE
            RETURN NEW;
        END IF;
        UPDATE synthetic_beta_guard
           SET rows_written = rows_written + 1,
               updated_at = CURRENT_TIMESTAMP
         WHERE guard_id
           AND allowlist_state = 'ENABLED'
           AND environment IN ('LOCAL', 'TEST', 'STAGING')
           AND expires_at > CURRENT_TIMESTAMP
           AND rows_written < row_budget
         RETURNING guard_id INTO guard_row;
        IF guard_row IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'synthetic_fixture requires an active bounded allowlist'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_care_plan_item_linkage_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    parent_patient UUID;
    parent_appointment UUID;
    parent_doctor UUID;
BEGIN
    SELECT patient_profile_id, appointment_id, doctor_id
      INTO parent_patient, parent_appointment, parent_doctor
      FROM patient_care_plans
     WHERE id = NEW.care_plan_id;
    IF parent_patient IS NULL
       OR parent_patient <> NEW.patient_profile_id
       OR parent_appointment <> NEW.appointment_id
       OR parent_doctor <> NEW.doctor_id THEN
        RAISE EXCEPTION 'care-plan item linkage must match its parent appointment and doctor'
            USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_care_plan_appointment_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    appointment_patient UUID;
    appointment_doctor UUID;
BEGIN
    SELECT patient_id, doctor_id
      INTO appointment_patient, appointment_doctor
      FROM appointments
     WHERE id = NEW.appointment_id;
    IF appointment_patient IS NULL
       OR appointment_patient <> NEW.patient_profile_id
       OR appointment_doctor <> NEW.doctor_id THEN
        RAISE EXCEPTION 'care plan must match appointment patient and doctor'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_synthetic_beta_guard_touch_updated_at
    BEFORE UPDATE ON synthetic_beta_guard
    FOR EACH ROW EXECUTE FUNCTION synthetic_beta_guard_touch_updated_at();
CREATE TRIGGER trg_patient_care_plans_touch_updated_at
    BEFORE UPDATE ON patient_care_plans
    FOR EACH ROW EXECUTE FUNCTION patient_care_plan_touch_updated_at();
CREATE TRIGGER trg_patient_care_plan_items_touch_updated_at
    BEFORE UPDATE ON patient_care_plan_items
    FOR EACH ROW EXECUTE FUNCTION patient_care_plan_touch_updated_at();
CREATE TRIGGER trg_patient_care_plan_item_linkage_guard
    BEFORE INSERT OR UPDATE ON patient_care_plan_items
    FOR EACH ROW EXECUTE FUNCTION patient_care_plan_item_linkage_guard();
CREATE TRIGGER trg_patient_care_plan_appointment_owner_guard
    BEFORE INSERT OR UPDATE ON patient_care_plans
    FOR EACH ROW EXECUTE FUNCTION patient_care_plan_appointment_owner_guard();

-- Synthetic fixture writes are opt-in and metered across identity, scheduling,
-- consultation, Q&A and care-plan rows. Real patient rows remain unaffected.
CREATE TRIGGER trg_users_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_profiles_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_appointments_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_threads_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_threads
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_participants_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_participants
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_messages_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_messages
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_attachments_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_attachments
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_read_states_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_read_states
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_consultation_events_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_events
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_health_questions_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON health_questions
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_health_question_answers_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON health_question_answers
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_health_question_reports_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON health_question_reports
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_care_plans_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_care_plans
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();
CREATE TRIGGER trg_patient_care_plan_items_synthetic_fixture_guard
    BEFORE INSERT OR UPDATE ON patient_care_plan_items
    FOR EACH ROW EXECUTE FUNCTION enforce_synthetic_fixture_guard();

REVOKE EXECUTE ON FUNCTION synthetic_beta_guard_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_care_plan_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION enforce_synthetic_fixture_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_care_plan_item_linkage_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_care_plan_appointment_owner_guard() FROM PUBLIC;

CREATE INDEX idx_synthetic_beta_guard_expiry
    ON synthetic_beta_guard(allowlist_state, expires_at)
    WHERE allowlist_state = 'ENABLED';
CREATE INDEX idx_users_synthetic_fixture
    ON users(synthetic_fixture, id) WHERE synthetic_fixture;
CREATE INDEX idx_patient_profiles_synthetic_fixture
    ON patient_profiles(synthetic_fixture, id) WHERE synthetic_fixture;
CREATE INDEX idx_appointments_synthetic_fixture
    ON appointments(synthetic_fixture, id) WHERE synthetic_fixture;
CREATE INDEX idx_patient_care_plans_patient_status
    ON patient_care_plans(patient_profile_id, status, updated_at DESC, id DESC);
CREATE INDEX idx_patient_care_plans_appointment
    ON patient_care_plans(appointment_id, doctor_id, updated_at DESC, id DESC);
CREATE INDEX idx_patient_care_plans_retention
    ON patient_care_plans(retention_expires_at, id);
CREATE INDEX idx_patient_care_plan_items_plan_sequence
    ON patient_care_plan_items(care_plan_id, sequence_number ASC);
CREATE INDEX idx_patient_care_plan_items_due
    ON patient_care_plan_items(patient_profile_id, due_at, status, id);
CREATE INDEX idx_patient_care_plan_items_retention
    ON patient_care_plan_items(retention_expires_at, id);

COMMENT ON TABLE synthetic_beta_guard IS
    'Singleton disabled-by-default synthetic fixture allowlist; production environment is not permitted.';
COMMENT ON COLUMN synthetic_beta_guard.manifest_hash IS
    'SHA-256 of the reviewed synthetic manifest; no patient content or auth secret.';
COMMENT ON TABLE patient_care_plan_items IS
    'Patient goals/reminders linked to one appointment and doctor; deliberately excludes AI treatment content.';
