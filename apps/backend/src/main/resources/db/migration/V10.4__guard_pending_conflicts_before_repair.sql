-- Run safety checks and normalize expired holds before V10.5 repairs live
-- pending overlaps and V11 creates branch-aware constraints. This ordering
-- point is separate so the already-applied V10.5 checksum never changes.
DO $$
DECLARE
    branchless_key uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    IF EXISTS (SELECT 1 FROM branches WHERE id = branchless_key)
        OR EXISTS (SELECT 1 FROM appointments WHERE branch_id = branchless_key) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'V10.4 preflight failed: the reserved zero UUID is already used as a branch key.',
            HINT = 'Reassign the zero-UUID branch/appointment before retrying the scheduling upgrade; this migration never deletes booking data.';
    END IF;
END $$;

-- Expired or malformed holds are not candidates for survivor selection. Keep
-- them as cancelled history before V10.5 resolves overlaps among live holds.
UPDATE appointments
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(cancellation_reason, 'Hết thời gian giữ chỗ (Quá 10 phút)')
WHERE status = 'PENDING_CONFIRMATION'
  AND (hold_expires_at IS NULL OR hold_expires_at <= CURRENT_TIMESTAMP);
