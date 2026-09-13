-- V74__sync_consultation_participants_for_demo_doctor.sql
-- Synchronize consultation participants, read states, and messages with current assigned doctor user accounts.
-- The V37 row guards validate against the CURRENT thread/doctor binding; this
-- repair migration deliberately bypasses them while it re-aligns historical
-- rows, then re-enables the guards so runtime writes stay protected.

ALTER TABLE patient_consultation_participants DISABLE TRIGGER trg_patient_consultation_participant_guard;

UPDATE patient_consultation_participants p
SET user_id = d.user_id
FROM patient_consultation_threads t
JOIN doctors d ON d.id = t.doctor_id
WHERE p.thread_id = t.id
  AND p.participant_role = 'ASSIGNED_DOCTOR'
  AND d.user_id IS NOT NULL
  AND p.user_id <> d.user_id;

ALTER TABLE patient_consultation_participants ENABLE TRIGGER trg_patient_consultation_participant_guard;

UPDATE patient_consultation_read_states r
SET user_id = d.user_id
FROM patient_consultation_threads t
JOIN doctors d ON d.id = t.doctor_id
WHERE r.thread_id = t.id
  AND d.user_id IS NOT NULL
  AND r.user_id <> d.user_id;

ALTER TABLE patient_consultation_messages DISABLE TRIGGER trg_patient_consultation_message_immutable;

UPDATE patient_consultation_messages m
SET author_user_id = d.user_id
FROM patient_consultation_threads t
JOIN doctors d ON d.id = t.doctor_id
WHERE m.thread_id = t.id
  AND m.author_role_snapshot = 'DOCTOR'
  AND d.user_id IS NOT NULL
  AND m.author_user_id = '90000000-0000-0000-0000-000000000002';

ALTER TABLE patient_consultation_messages ENABLE TRIGGER trg_patient_consultation_message_immutable;
