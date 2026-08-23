ALTER TABLE bank_transfer_payments
    ADD COLUMN submission_idempotency_key VARCHAR(100),
    ADD COLUMN submission_request_hash VARCHAR(64),
    ADD COLUMN refund_reference VARCHAR(100),
    ADD COLUMN refunded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN refunded_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_bank_transfer_submission_idempotency
    ON bank_transfer_payments(submission_idempotency_key)
    WHERE submission_idempotency_key IS NOT NULL;

ALTER TABLE bank_transfer_payments
    ADD CONSTRAINT ck_bank_transfer_refund CHECK (
        (status <> 'REFUNDED') OR (refund_reference IS NOT NULL AND refunded_at IS NOT NULL)
    );

CREATE TABLE payment_webhook_events (
    event_id VARCHAR(120) PRIMARY KEY,
    payload_hash VARCHAR(64) NOT NULL,
    payment_id UUID REFERENCES bank_transfer_payments(id) ON DELETE SET NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE payment_audit_logs (
    id UUID PRIMARY KEY,
    actor_email VARCHAR(320),
    action VARCHAR(80) NOT NULL,
    payment_id UUID REFERENCES bank_transfer_payments(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    details VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_audit_logs_payment_created
    ON payment_audit_logs(payment_id, created_at DESC);
