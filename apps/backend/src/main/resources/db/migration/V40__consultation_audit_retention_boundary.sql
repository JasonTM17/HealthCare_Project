-- Keep consultation audit rows after transcript/thread retention cleanup.
-- Message, attachment and participant rows may be removed with the patient
-- thread; audit events remain as non-content evidence with a nullable
-- relationship to the deleted thread.

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname
      INTO constraint_name
      FROM pg_constraint
     WHERE conrelid = 'patient_consultation_events'::regclass
       AND contype = 'f'
       AND confrelid = 'patient_consultation_threads'::regclass
     LIMIT 1;
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE patient_consultation_events DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE patient_consultation_events
    ALTER COLUMN thread_id DROP NOT NULL;

ALTER TABLE patient_consultation_events
    ADD CONSTRAINT fk_patient_consultation_event_thread
    FOREIGN KEY (thread_id)
    REFERENCES patient_consultation_threads(id)
    ON DELETE SET NULL;

-- The FK action is an internal retention update.  Permit only that narrowly
-- scoped nullification while the cleanup transaction holds its private GUC;
-- ordinary callers still get the append-only guard.
CREATE OR REPLACE FUNCTION patient_consultation_event_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND current_setting('healthcare.retention_cleanup', true) = 'on'
       AND OLD.thread_id IS NOT NULL
       AND NEW.thread_id IS NULL
       AND NEW.id = OLD.id
       AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
       AND NEW.actor_role_snapshot IS NOT DISTINCT FROM OLD.actor_role_snapshot
       AND NEW.event_type = OLD.event_type
       AND NEW.correlation_id = OLD.correlation_id
       AND NEW.metadata = OLD.metadata
       AND NEW.occurred_at = OLD.occurred_at
       AND NEW.synthetic_fixture = OLD.synthetic_fixture THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'consultation audit events are append-only'
        USING ERRCODE = '55006';
END;
$$;

REVOKE EXECUTE ON FUNCTION patient_consultation_event_immutable() FROM PUBLIC;

CREATE INDEX idx_patient_consultation_events_audit_time
    ON patient_consultation_events(occurred_at DESC, id DESC);

COMMENT ON COLUMN patient_consultation_events.thread_id IS
    'Nullable after thread retention/delete; event content remains append-only audit evidence.';
