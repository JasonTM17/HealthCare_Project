-- Normalize legacy scheduling rows to the single ISO-8601 convention used by
-- Java LocalDate#getDayOfWeek: Monday=1 through Sunday=7.
ALTER TABLE doctor_schedules
    DROP CONSTRAINT IF EXISTS ck_schedule_day_of_week;

UPDATE doctor_schedules
SET day_of_week = 7
WHERE day_of_week = 0;

ALTER TABLE doctor_schedules
    ADD CONSTRAINT ck_schedule_day_of_week CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE doctor_schedules
    ADD CONSTRAINT ck_schedule_effective_range
        CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- V4 allowed nullable end times. Normalize legacy rows before making the
-- interval boundary mandatory for overlap checks and exclusion enforcement.
UPDATE appointments
SET end_time = start_time + INTERVAL '30 minutes'
WHERE end_time IS NULL;

ALTER TABLE appointments
    ALTER COLUMN end_time SET NOT NULL;

ALTER TABLE appointments
    ADD CONSTRAINT ck_appointment_time_range CHECK (start_time < end_time);

-- Keep V8's exact active-slot invariant and add the interval invariant needed
-- when a schedule uses durations other than 30 minutes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
    ADD CONSTRAINT ex_appointments_active_interval
    EXCLUDE USING gist (
        doctor_id WITH =,
        appointment_date WITH =,
        tsrange(appointment_date + start_time, appointment_date + end_time, '[)') WITH &&
    )
    WHERE (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'));

CREATE INDEX idx_appointments_active_interval
    ON appointments (doctor_id, appointment_date, start_time, end_time)
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
