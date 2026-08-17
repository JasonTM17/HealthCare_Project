-- Scope active-booking uniqueness and interval exclusion by branch.
-- The zero UUID is reserved as the normalized key for legacy branchless rows.
-- V11 fails before changing constraints if that key is already a real branch.
DO $$
DECLARE
    branchless_key uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    IF EXISTS (SELECT 1 FROM branches WHERE id = branchless_key)
        OR EXISTS (SELECT 1 FROM appointments WHERE branch_id = branchless_key) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'V11 preflight failed: the reserved zero UUID is already used as a branch key.',
            HINT = 'Reassign the zero-UUID branch/appointment to a real branch before retrying V11; this migration never deletes booking data.';
    END IF;
END $$;

DROP INDEX IF EXISTS uq_appointments_active_slot;

ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS ex_appointments_active_interval;

CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments (
        doctor_id,
        appointment_date,
        (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)),
        start_time
    )
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');

ALTER TABLE appointments
    ADD CONSTRAINT ex_appointments_active_interval
    EXCLUDE USING gist (
        doctor_id WITH =,
        appointment_date WITH =,
        (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        tsrange(appointment_date + start_time, appointment_date + end_time, '[)') WITH &&
    )
    WHERE (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'));

-- Keep the lookup index aligned with the branch-aware repository predicates.
DROP INDEX IF EXISTS idx_appointments_active_interval;

CREATE INDEX idx_appointments_active_interval
    ON appointments (doctor_id, appointment_date, branch_id, start_time, end_time)
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
