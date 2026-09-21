-- Persist the client-supplied Idempotency-Key of a slot hold so a retried
-- POST /api/v1/appointments/hold returns the original hold instead of
-- creating a second appointment (or failing with a slot conflict) when the
-- first response was lost to a gateway timeout.
--
-- The column is nullable on purpose: clients that do not send the header keep
-- working exactly as before, and no historical row is rewritten. The unique
-- index is partial so those NULL keys never collide with each other.
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS hold_idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_hold_idempotency_key
    ON appointments (hold_idempotency_key)
    WHERE hold_idempotency_key IS NOT NULL;
