-- Repair legacy pending holds before V11 creates branch-aware uniqueness and
-- interval constraints. Keep the earliest pending hold for each scope and
-- preserve every later conflict as cancelled booking history.
--
-- Confirmed/in-progress appointments always win over pending holds. The loop
-- is intentionally deterministic so a retry produces the same survivor set.
DO $$
DECLARE
    branchless_key uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    IF EXISTS (SELECT 1 FROM branches WHERE id = branchless_key)
        OR EXISTS (SELECT 1 FROM appointments WHERE branch_id = branchless_key) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'V10.5 preflight failed: the reserved zero UUID is already used as a branch key.',
            HINT = 'Reassign the zero-UUID branch/appointment before retrying the scheduling upgrade; this migration never deletes booking data.';
    END IF;
END $$;

-- Expired or malformed holds are not candidates for survivor selection. Keep
-- them as cancelled history before resolving overlaps among live holds.
UPDATE appointments
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(cancellation_reason, 'Hết thời gian giữ chỗ (Quá 10 phút)')
WHERE status = 'PENDING_CONFIRMATION'
  AND (hold_expires_at IS NULL OR hold_expires_at <= CURRENT_TIMESTAMP);

DO $$
DECLARE
    candidate RECORD;
    has_conflict boolean;
    branchless_key uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    FOR candidate IN
        SELECT
            id,
            doctor_id,
            appointment_date,
            COALESCE(branch_id, branchless_key) AS branch_key,
            start_time,
            end_time,
            created_at
        FROM appointments
        WHERE status = 'PENDING_CONFIRMATION'
        ORDER BY created_at ASC, id ASC
    LOOP
        SELECT EXISTS (
            SELECT 1
            FROM appointments existing
            WHERE existing.id <> candidate.id
              AND existing.doctor_id = candidate.doctor_id
              AND existing.appointment_date = candidate.appointment_date
              AND COALESCE(existing.branch_id, branchless_key) = candidate.branch_key
              AND existing.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
              AND tsrange(
                    existing.appointment_date + existing.start_time,
                    existing.appointment_date + existing.end_time,
                    '[)'
                  ) && tsrange(
                    candidate.appointment_date + candidate.start_time,
                    candidate.appointment_date + candidate.end_time,
                    '[)'
                  )
        ) INTO has_conflict;

        IF has_conflict THEN
            UPDATE appointments
            SET status = 'CANCELLED',
                cancellation_reason = COALESCE(
                    cancellation_reason,
                    'Hủy giữ chỗ trùng khi nâng cấp dữ liệu trước V11'
                )
            WHERE id = candidate.id;
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM appointments existing
            WHERE existing.id <> candidate.id
              AND existing.doctor_id = candidate.doctor_id
              AND existing.appointment_date = candidate.appointment_date
              AND COALESCE(existing.branch_id, branchless_key) = candidate.branch_key
              AND existing.status = 'PENDING_CONFIRMATION'
              AND (
                    existing.created_at < candidate.created_at
                    OR (
                        existing.created_at = candidate.created_at
                        AND existing.id < candidate.id
                    )
                  )
              AND tsrange(
                    existing.appointment_date + existing.start_time,
                    existing.appointment_date + existing.end_time,
                    '[)'
                  ) && tsrange(
                    candidate.appointment_date + candidate.start_time,
                    candidate.appointment_date + candidate.end_time,
                    '[)'
                  )
        ) INTO has_conflict;

        IF has_conflict THEN
            UPDATE appointments
            SET status = 'CANCELLED',
                cancellation_reason = COALESCE(
                    cancellation_reason,
                    'Hủy giữ chỗ trùng khi nâng cấp dữ liệu trước V11'
                )
            WHERE id = candidate.id;
        END IF;
    END LOOP;
END $$;
