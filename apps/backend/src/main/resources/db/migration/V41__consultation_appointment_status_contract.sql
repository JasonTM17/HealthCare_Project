-- Align the database-owned consultation eligibility rule with the public V37
-- contract. IN_PROGRESS is intentionally excluded; a thread must be opened
-- while the appointment is confirmed/checked-in or after it is completed.

CREATE OR REPLACE FUNCTION patient_consultation_thread_window_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    appointment_status VARCHAR(32);
    appointment_at TIMESTAMP WITH TIME ZONE;
    expected_open TIMESTAMP WITH TIME ZONE;
    expected_retention TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT status, appointment_time
      INTO appointment_status, appointment_at
      FROM appointments
     WHERE id = NEW.appointment_id
       AND patient_id = NEW.patient_profile_id
       AND doctor_id = NEW.doctor_id;
    IF appointment_at IS NULL OR appointment_status NOT IN
        ('CONFIRMED', 'CHECKED_IN', 'COMPLETED') THEN
        RAISE EXCEPTION 'consultation requires a confirmed/check-in/completed appointment'
            USING ERRCODE = '42501';
    END IF;
    expected_open := appointment_at + INTERVAL '30 days';
    expected_retention := appointment_at + INTERVAL '90 days';
    IF TG_OP = 'INSERT' THEN
        NEW.consultation_open_until := expected_open;
        NEW.retention_expires_at := expected_retention;
    ELSE
        IF NEW.consultation_open_until <> OLD.consultation_open_until
           OR NEW.retention_expires_at <> OLD.retention_expires_at THEN
            RAISE EXCEPTION 'consultation window and retention deadline are database-owned'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.version <> OLD.version + 1 THEN
            RAISE EXCEPTION 'consultation optimistic version must advance by one'
                USING ERRCODE = '40001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION patient_consultation_thread_window_guard() FROM PUBLIC;
