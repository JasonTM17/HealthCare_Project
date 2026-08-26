ALTER TABLE appointments
    ADD COLUMN otp_issued_at TIMESTAMP WITH TIME ZONE;

-- Legacy pending rows did not retain the issue instant. Use the safest
-- conservative reconstruction available so a migration cannot open a
-- resend window earlier than the original five-minute OTP lifetime.
UPDATE appointments
SET otp_issued_at = GREATEST(created_at, otp_expires_at - INTERVAL '5 minutes')
WHERE otp_code IS NOT NULL
  AND otp_expires_at IS NOT NULL
  AND otp_issued_at IS NULL;

COMMENT ON COLUMN appointments.otp_issued_at IS
    'Server-owned issue instant for OTP resend throttling; cleared with the OTP.';
