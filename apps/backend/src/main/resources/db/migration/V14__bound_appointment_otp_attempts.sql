ALTER TABLE appointments
    ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE appointments
    ADD CONSTRAINT ck_appointments_otp_attempts_non_negative CHECK (otp_attempts >= 0);
