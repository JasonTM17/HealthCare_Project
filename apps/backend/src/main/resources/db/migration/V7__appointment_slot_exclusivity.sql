-- Serialize slot creation in the service and prevent duplicate active bookings
-- if another writer bypasses the application-level advisory lock.
CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments (doctor_id, appointment_date, start_time)
    WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
