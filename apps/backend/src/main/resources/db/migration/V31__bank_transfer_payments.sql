ALTER TABLE appointments DROP CONSTRAINT ck_payment_status;
ALTER TABLE appointments
    ADD CONSTRAINT ck_payment_status CHECK (payment_status IN (
        'UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'
    ));

CREATE TABLE bank_transfer_payments (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    transfer_content VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
    transaction_reference VARCHAR(100),
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bank_transfer_amount CHECK (amount > 0),
    CONSTRAINT ck_bank_transfer_currency CHECK (currency = 'VND'),
    CONSTRAINT ck_bank_transfer_status CHECK (status IN (
        'UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'
    )),
    CONSTRAINT ck_bank_transfer_submission CHECK (
        (status IN ('UNPAID', 'REJECTED') OR submitted_at IS NOT NULL)
        AND (status <> 'PENDING_VERIFICATION' OR transaction_reference IS NOT NULL)
        AND (status NOT IN ('PAID', 'REFUND_PENDING', 'REFUNDED') OR verified_at IS NOT NULL)
    )
);

CREATE INDEX idx_bank_transfer_payments_status_created
    ON bank_transfer_payments(status, created_at DESC);
