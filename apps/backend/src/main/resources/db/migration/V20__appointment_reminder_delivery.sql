ALTER TABLE appointments
    ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_appointments_due_reminders
    ON appointments(appointment_time)
    WHERE status = 'CONFIRMED' AND reminder_sent_at IS NULL;
