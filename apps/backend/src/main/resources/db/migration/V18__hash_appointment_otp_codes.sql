-- BCrypt hashes are longer than the legacy six-digit plaintext value.
-- Existing rows are retained; BookingService accepts them for one release so
-- an in-flight local hold is not invalidated during deployment.
ALTER TABLE appointments
    ALTER COLUMN otp_code TYPE VARCHAR(100);
