-- V74__sync_consultation_participants_for_demo_doctor.sql
-- Synchronize consultation participants, read states, and messages with current assigned doctor user accounts

UPDATE patient_consultation_participants p
SET user_id = d.user_id
FROM patient_consultation_threads t
JOIN doctors d ON d.id = t.doctor_id
WHERE p.thread_id = t.id
  AND p.participant_role = 'ASSIGNED_DOCTOR'
  AND d.user_id IS NOT NULL
  AND p.user_id <> d.user_id;

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
