CREATE INDEX idx_email_outbox_terminal_retention
    ON email_outbox(status, updated_at)
    WHERE status IN ('SENT', 'EXPIRED', 'DEAD');

COMMENT ON INDEX idx_email_outbox_terminal_retention IS
    'Supports bounded cleanup of terminal email envelopes without touching active retries.';
