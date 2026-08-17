-- Keep branch selection a database invariant, not only an API validation.
-- A doctor may only have schedules, exceptions, or appointments at an
-- explicitly assigned branch. The nullable appointment branch intentionally
-- remains allowed for the legacy/local demo flow.
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
