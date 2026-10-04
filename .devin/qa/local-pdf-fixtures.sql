BEGIN;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';
DO $local_pdf_fixture$
DECLARE
    patient_uid uuid;
    doctor_uid uuid;
    branch_uid uuid;
    specialty_uid uuid;
    hospital_date date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    clinical_uid constant uuid := 'd0410000-0000-4000-8000-000000000001';
    reminder_uid constant uuid := 'd0410000-0000-4000-8000-000000000002';
    fixture_note constant text := 'ISOLATED-LOCAL-PDF-AUDIT';
BEGIN
    IF current_database() <> 'healthcare' THEN
        RAISE EXCEPTION 'Refusing PDF fixture creation outside the isolated audit application database';
    END IF;
    SELECT p.id INTO STRICT patient_uid
      FROM patient_profiles p JOIN users u ON u.id = p.user_id
     WHERE u.email = 'patient@healthcare.local' AND u.status = 'ACTIVE';
    SELECT d.id INTO STRICT doctor_uid
      FROM doctors d JOIN users u ON u.id = d.user_id
     WHERE u.email = 'doctor@healthcare.local' AND u.status = 'ACTIVE' AND d.active;
    SELECT db.branch_id INTO branch_uid
      FROM doctor_branches db JOIN branches b ON b.id = db.branch_id
     WHERE db.doctor_id = doctor_uid AND b.active
     ORDER BY db.branch_id LIMIT 1;
    SELECT ds.specialty_id INTO specialty_uid
      FROM doctor_specialties ds JOIN specialties s ON s.id = ds.specialty_id
     WHERE ds.doctor_id = doctor_uid AND s.active
     ORDER BY ds.specialty_id LIMIT 1;
    IF branch_uid IS NULL OR specialty_uid IS NULL THEN
        RAISE EXCEPTION 'Local audit doctor catalog links are missing';
    END IF;
    IF EXISTS (
        SELECT 1 FROM appointments
         WHERE id IN (clinical_uid, reminder_uid)
           AND (patient_id <> patient_uid OR doctor_id <> doctor_uid
                OR notes IS DISTINCT FROM fixture_note OR NOT synthetic_fixture)
    ) THEN
        RAISE EXCEPTION 'Reserved PDF fixture identity belongs to different data; nothing will be overwritten';
    END IF;
    INSERT INTO appointments
        (id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
         appointment_date, start_time, end_time, appointment_time, status,
         payment_status, reason_for_visit, notes, has_insurance, otp_attempts,
         synthetic_fixture)
    VALUES
        (clinical_uid, 'HC-LOCAL-PDF-CLINICAL', patient_uid, doctor_uid, branch_uid, specialty_uid,
         hospital_date, TIME '06:00', TIME '06:30',
         (hospital_date + TIME '06:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'IN_PROGRESS',
         'UNPAID', 'Synthetic local PDF verification encounter; not a real clinical visit',
         fixture_note, FALSE, 0, TRUE),
        (reminder_uid, 'HC-LOCAL-PDF-REMINDER', patient_uid, doctor_uid, branch_uid, specialty_uid,
         hospital_date + 7, TIME '06:00', TIME '06:30',
         (hospital_date + 7 + TIME '06:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'CONFIRMED',
         'UNPAID', 'Synthetic local appointment reminder verification',
         fixture_note, FALSE, 0, TRUE)
    ON CONFLICT (id) DO NOTHING;
    IF EXISTS (
        SELECT 1 FROM appointments
         WHERE id = clinical_uid AND status NOT IN ('IN_PROGRESS', 'COMPLETED')
    ) OR EXISTS (
        SELECT 1 FROM appointments
         WHERE id = reminder_uid AND status <> 'CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'PDF fixture lifecycle was modified; preserve it and stop rather than resetting data';
    END IF;
END;
$local_pdf_fixture$;
COMMIT;
