CREATE TABLE appointment_account_claims (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claim_source VARCHAR(40) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_appointment_claim_source CHECK (claim_source IN ('BOOKING_OTP', 'EMAIL_VERIFICATION'))
);

CREATE INDEX idx_appointment_account_claims_user
    ON appointment_account_claims(user_id, claimed_at DESC);
