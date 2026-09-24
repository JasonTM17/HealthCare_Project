-- Dead-letter surface for bank webhook evidence that can never be matched.
-- The retry worker used to give up after 20 attempts with only a log line;
-- these columns plus the admin webhook-events endpoint make the abandoned
-- rows visible and actionable (manual refund / patient contact) instead.
ALTER TABLE payment_webhook_events
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(300),
    ADD COLUMN IF NOT EXISTS permanent_failure BOOLEAN NOT NULL DEFAULT FALSE;

-- The admin view lists dead rows first, then the freshest unmatched evidence.
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_unprocessed
    ON payment_webhook_events (permanent_failure, received_at DESC)
    WHERE processed_at IS NULL;
