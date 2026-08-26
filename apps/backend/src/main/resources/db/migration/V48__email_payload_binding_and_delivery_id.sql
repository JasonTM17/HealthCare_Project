ALTER TABLE email_outbox
    ADD COLUMN payload_digest VARCHAR(64),
    ADD COLUMN delivery_message_id VARCHAR(160);

-- Existing V44 rows cannot be re-hashed without decrypting their payload. They
-- remain replayable only through the legacy event boundary; all new rows are
-- bound to a keyed digest before they can be acknowledged as idempotent.
CREATE INDEX idx_email_outbox_delivery_message_id
    ON email_outbox(delivery_message_id)
    WHERE delivery_message_id IS NOT NULL;

COMMENT ON COLUMN email_outbox.payload_digest IS
    'HMAC-SHA-256 of the encrypted recipient/template variables; binds idempotency replay without storing clear content.';
COMMENT ON COLUMN email_outbox.delivery_message_id IS
    'Stable Message-ID seed reused across lease retries to reduce duplicate provider delivery.';
