-- Make the database invariant cover active holds as well as confirmed visits.
-- Expired/invalid pending rows are released before the unique index is rebuilt;
-- the booking transaction also expires matching holds while holding the slot lock.
UPDATE appointments
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(cancellation_reason, 'Hết thời gian giữ chỗ (Quá 10 phút)')
WHERE status = 'PENDING_CONFIRMATION'
  AND (hold_expires_at IS NULL OR hold_expires_at <= CURRENT_TIMESTAMP);

-- Legacy databases may contain more than one still-live pending hold for the
-- same exact slot because the old schema did not cover PENDING_CONFIRMATION.
-- Preserve the deterministic canonical row (oldest created_at, then smallest
-- UUID) and cancel the rest before creating the unique index. Never delete
-- booking history or silently choose a later hold.
WITH ranked_pending AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY doctor_id, appointment_date, start_time
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

CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments (doctor_id, appointment_date, start_time)
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
