ALTER TABLE appointments
    ADD COLUMN has_insurance BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE appointments
    ADD COLUMN privacy_consent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE appointments
    ADD COLUMN privacy_consent_version VARCHAR(32);
