-- Repair legacy databases that reached the branch-aware constraints with
-- duplicate live pending holds. Keep the oldest booking and preserve later
-- rows as cancelled history; never delete booking data.
WITH ranked_pending AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                doctor_id,
                appointment_date,
                COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                start_time
            ORDER BY created_at ASC, id ASC
        ) AS duplicate_rank
    FROM appointments
    WHERE status = 'PENDING_CONFIRMATION'
)
UPDATE appointments a
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(
        a.cancellation_reason,
        'Hủy giữ chỗ trùng khi nâng cấp dữ liệu (giữ bản ghi tạo sớm nhất)'
    )
FROM ranked_pending r
WHERE a.id = r.id
  AND r.duplicate_rank > 1;

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

DROP INDEX IF EXISTS idx_appointments_active_interval;

CREATE INDEX idx_appointments_active_interval
    ON appointments (doctor_id, appointment_date, branch_id, start_time, end_time)
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
