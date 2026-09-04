-- V60__seed_doctor_schedules_and_link_demo_doctor.sql
-- 1. Link demo doctor account (doctor@healthcare.com) to TS.BS Nguyễn Minh Khôi
-- who owns the seeded patient appointments, medical records, and consultations.
UPDATE users
SET display_name = 'TS.BS Nguyễn Minh Khôi'
WHERE id = '90000000-0000-0000-0000-000000000023';

UPDATE doctors
SET user_id = NULL
WHERE id = '30000000-0000-0000-0000-000000000005';

UPDATE doctors
SET user_id = '90000000-0000-0000-0000-000000000023'
WHERE id = '30000000-0000-0000-0000-000000000001';

-- 2. Seed recurring doctor schedules for all hospital branches
-- Monday (1) through Saturday (6), 08:00 - 17:00, 30 min slots
INSERT INTO doctor_schedules (
    id, doctor_id, branch_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, active
)
SELECT
    gen_random_uuid(),
    db.doctor_id,
    db.branch_id,
    day_num,
    '08:00:00'::time,
    '17:00:00'::time,
    30,
    '2026-01-01'::date,
    true
FROM doctor_branches db
CROSS JOIN generate_series(1, 6) AS day_num
ON CONFLICT DO NOTHING;
