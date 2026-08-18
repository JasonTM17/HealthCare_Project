-- Make the database invariant cover active holds as well as confirmed visits.
-- Expired/invalid pending rows are released before the unique index is rebuilt;
-- the booking transaction also expires matching holds while holding the slot lock.
UPDATE appointments
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(cancellation_reason, 'Hết thời gian giữ chỗ (Quá 10 phút)')
WHERE status = 'PENDING_CONFIRMATION'
  AND (hold_expires_at IS NULL OR hold_expires_at <= CURRENT_TIMESTAMP);

DROP INDEX IF EXISTS uq_appointments_active_slot;

CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments (doctor_id, appointment_date, start_time)
    WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
