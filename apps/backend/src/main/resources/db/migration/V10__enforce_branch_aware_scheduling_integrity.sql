-- Keep branch selection a database invariant, not only an API validation.
-- A doctor may only have schedules, exceptions, or appointments at an
-- explicitly assigned branch. The nullable appointment branch intentionally
-- remains allowed for the legacy/local demo flow.
DO $$
DECLARE
    invalid_schedule_count integer;
    invalid_exception_count integer;
    invalid_appointment_count integer;
BEGIN
    SELECT count(*)
    INTO invalid_schedule_count
    FROM doctor_schedules s
    LEFT JOIN doctor_branches db
        ON db.doctor_id = s.doctor_id
       AND db.branch_id = s.branch_id
    WHERE db.doctor_id IS NULL;

    SELECT count(*)
    INTO invalid_exception_count
    FROM doctor_schedule_exceptions e
    LEFT JOIN doctor_branches db
        ON db.doctor_id = e.doctor_id
       AND db.branch_id = e.branch_id
    WHERE db.doctor_id IS NULL;

    SELECT count(*)
    INTO invalid_appointment_count
    FROM appointments a
    LEFT JOIN doctor_branches db
        ON db.doctor_id = a.doctor_id
       AND db.branch_id = a.branch_id
    WHERE a.branch_id IS NOT NULL
      AND db.doctor_id IS NULL;

    IF invalid_schedule_count > 0
        OR invalid_exception_count > 0
        OR invalid_appointment_count > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'V10 preflight failed: %s schedule rows, %s exception rows, and %s branch-scoped appointment rows reference an unassigned doctor/branch pair.',
                invalid_schedule_count,
                invalid_exception_count,
                invalid_appointment_count
            ),
            HINT = 'Repair or explicitly reassign the reported rows in doctor_branches before retrying V10; this migration never deletes production data.';
    END IF;
END $$;

ALTER TABLE doctor_schedules
    ADD CONSTRAINT fk_doctor_schedules_doctor_branch
    FOREIGN KEY (doctor_id, branch_id)
    REFERENCES doctor_branches (doctor_id, branch_id)
    ON DELETE RESTRICT;

ALTER TABLE doctor_schedule_exceptions
    ADD CONSTRAINT fk_schedule_exceptions_doctor_branch
    FOREIGN KEY (doctor_id, branch_id)
    REFERENCES doctor_branches (doctor_id, branch_id)
    ON DELETE RESTRICT;

ALTER TABLE appointments
    ADD CONSTRAINT fk_appointments_doctor_branch
    FOREIGN KEY (doctor_id, branch_id)
    REFERENCES doctor_branches (doctor_id, branch_id)
    ON DELETE RESTRICT;

-- CUSTOM_HOURS without a valid interval would silently fall back to the
-- recurring schedule. Reject that ambiguous state at the database boundary.
ALTER TABLE doctor_schedule_exceptions
    ADD CONSTRAINT ck_schedule_exception_custom_range
    CHECK (
        type <> 'CUSTOM_HOURS'
        OR (
            custom_start_time IS NOT NULL
            AND custom_end_time IS NOT NULL
            AND custom_start_time < custom_end_time
        )
    );
