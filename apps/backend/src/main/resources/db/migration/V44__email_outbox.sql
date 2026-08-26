CREATE TABLE email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_reference_id UUID,
    event_type VARCHAR(64),
    template_key VARCHAR(64) NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    payload_ciphertext BYTEA,
    payload_nonce BYTEA,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_token UUID,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    last_error_code VARCHAR(64),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_email_outbox_template_version CHECK (template_version > 0),
    CONSTRAINT ck_email_outbox_status CHECK (
        status IN ('QUEUED', 'PROCESSING', 'RETRY', 'SENT', 'EXPIRED', 'DEAD')
    ),
    CONSTRAINT ck_email_outbox_attempts CHECK (attempts >= 0 AND attempts <= 100),
    CONSTRAINT ck_email_outbox_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_email_outbox_lease_pair CHECK (
        (lease_token IS NULL AND lease_expires_at IS NULL)
        OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    ),
    CONSTRAINT ck_email_outbox_payload_lifecycle CHECK (
        (status IN ('QUEUED', 'PROCESSING', 'RETRY')
            AND payload_ciphertext IS NOT NULL AND payload_nonce IS NOT NULL)
        OR (status IN ('SENT', 'EXPIRED', 'DEAD')
            AND payload_ciphertext IS NULL AND payload_nonce IS NULL)
    )
);

CREATE INDEX idx_email_outbox_due
    ON email_outbox(status, available_at, created_at)
    WHERE status IN ('QUEUED', 'RETRY');

CREATE INDEX idx_email_outbox_expiry
    ON email_outbox(expires_at)
    WHERE status IN ('QUEUED', 'PROCESSING', 'RETRY');

CREATE INDEX idx_email_outbox_user_created
    ON email_outbox(user_id, created_at DESC);

COMMENT ON TABLE email_outbox IS
    'Encrypted, lease-based transactional email queue. Rendered content and provider errors are never stored in clear text.';
COMMENT ON COLUMN email_outbox.payload_ciphertext IS
    'AES-GCM encrypted template variables, recipient and message context; cleared on SENT, EXPIRED or DEAD.';
COMMENT ON COLUMN email_outbox.payload_nonce IS
    'Unique per-row AES-GCM nonce; cleared with the encrypted payload.';
COMMENT ON COLUMN email_outbox.last_error_code IS
    'Closed operational error code only; raw provider errors are deliberately excluded.';
