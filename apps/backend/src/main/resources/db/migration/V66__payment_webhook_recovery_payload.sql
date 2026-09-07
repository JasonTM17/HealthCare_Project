ALTER TABLE payment_webhook_events
    ADD COLUMN transfer_content VARCHAR(64),
    ADD COLUMN amount NUMERIC,
    ADD COLUMN transaction_reference VARCHAR(100),
    ADD COLUMN retry_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Hash-only legacy evidence requires authenticated redelivery or reconciliation.
ALTER TABLE payment_webhook_events
    ADD CONSTRAINT payment_webhook_recovery_payload_complete CHECK (
        (transfer_content IS NULL AND amount IS NULL AND transaction_reference IS NULL)
        OR (transfer_content IS NOT NULL AND amount >= 1 AND amount IS NOT NULL
            AND transaction_reference IS NOT NULL)
    ),
    ADD CONSTRAINT payment_webhook_retry_attempts_nonnegative CHECK (retry_attempts >= 0);

CREATE INDEX idx_payment_webhook_retry_due
    ON payment_webhook_events (next_retry_at, received_at)
    WHERE processed_at IS NULL AND transfer_content IS NOT NULL;
