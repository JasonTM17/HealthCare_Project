-- ==========================================================================
-- V83__seed_big_data_doctor_schedules_and_avatars.sql
-- 1. Ensure 100% of doctors have local curated portraits (no NULLs or Unsplash)
--    retaining dedicated photos for the 6 core clinical leaders.
-- 2. Ensure 100% of active doctors are assigned to active hospital branches.
-- 3. Remove conflicting legacy shifts (08:00-17:00, 08:00-11:30, 13:30-17:00).
-- 4. Seed comprehensive Big Data recurring schedules for all 7 days (Mon-Sun)
--    with morning (08:00-12:00) and afternoon (13:30-17:30) 30-minute slots.
-- ==========================================================================

-- Step 1: Remediate doctor photo_url to reliable local clinical portraits
-- Ensure the 6 core clinical leaders maintain their dedicated portraits
UPDATE doctors SET photo_url = '/media/doctors/doctor-1.jpg' WHERE slug = 'nguyen-minh-khoi';
UPDATE doctors SET photo_url = '/media/doctors/doctor-2.jpg' WHERE slug = 'vo-thi-mai';
UPDATE doctors SET photo_url = '/media/doctors/doctor-3.jpg' WHERE slug = 'le-van-duc';
UPDATE doctors SET photo_url = '/media/doctors/doctor-4.jpg' WHERE slug = 'pham-hoang-yen';
UPDATE doctors SET photo_url = '/media/doctors/doctor-5.jpg' WHERE slug = 'tran-thu-ha';
UPDATE doctors SET photo_url = '/media/doctors/doctor-6.jpg' WHERE slug = 'do-quang-huy';

-- Distribute standard clinical portraits (doctor-1.jpg to doctor-11.jpg) to all other doctors
UPDATE doctors
SET photo_url = '/media/doctors/doctor-' || ((abs(hashtext(id::text)::bigint) % 11) + 1) || '.jpg'
WHERE slug NOT IN ('nguyen-minh-khoi', 'vo-thi-mai', 'le-van-duc', 'pham-hoang-yen', 'tran-thu-ha', 'do-quang-huy')
  AND (photo_url IS NULL OR btrim(photo_url) = '' OR photo_url LIKE '%unsplash%' OR photo_url NOT LIKE '/media/doctors/doctor-%.jpg');

-- Step 2: Ensure 100% of active doctors are assigned to at least one active branch
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT
    gen_random_uuid(),
    d.id,
    b.id
FROM doctors d
CROSS JOIN LATERAL (
    SELECT id FROM branches WHERE active = true ORDER BY id LIMIT 1
) b
WHERE d.active = true
  AND NOT EXISTS (
      SELECT 1 FROM doctor_branches db
      JOIN branches b2 ON b2.id = db.branch_id
      WHERE db.doctor_id = d.id AND b2.active = true
  )
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

-- Step 3: Remove conflicting legacy shifts that break standard 8-slot windows
-- (specifically V61 08:00-17:00 full-day and V67 08:00-11:30 / 13:30-17:00 short shifts)
DELETE FROM doctor_schedules
WHERE (start_time = TIME '08:00:00' AND end_time = TIME '17:00:00')
   OR (start_time = TIME '08:00:00' AND end_time = TIME '11:30:00')
   OR (start_time = TIME '13:30:00' AND end_time = TIME '17:00:00');

-- Step 4: Seed recurring schedules for ALL active doctors on ALL 7 days of the week (1=Mon to 7=Sun)
-- Morning shift: 08:00 - 12:00 (8 30-min slots: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30)
-- Afternoon shift: 13:30 - 17:30 (8 30-min slots: 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00)
INSERT INTO doctor_schedules (
    id, doctor_id, branch_id, day_of_week, start_time, end_time,
    slot_duration_minutes, effective_from, effective_to, active
)
SELECT
    md5('sched-v83:' || db.doctor_id::text || ':' || db.branch_id::text || ':' || day_num || ':' || shift.start_time::text)::uuid,
    db.doctor_id,
    db.branch_id,
    day_num,
    shift.start_time,
    shift.end_time,
    30,
    DATE '2026-01-01',
    NULL,
    true
FROM doctor_branches db
JOIN doctors d ON d.id = db.doctor_id AND d.active = true
JOIN branches b ON b.id = db.branch_id AND b.active = true
CROSS JOIN generate_series(1, 7) AS day_num
CROSS JOIN (
    VALUES
        (TIME '08:00:00', TIME '12:00:00'),
        (TIME '13:30:00', TIME '17:30:00')
) AS shift(start_time, end_time)
ON CONFLICT (id) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    slot_duration_minutes = EXCLUDED.slot_duration_minutes,
    effective_from = EXCLUDED.effective_from,
    effective_to = NULL,
    active = true;

-- Step 5: Assertion check to guarantee 100% portrait compliance
DO $$
DECLARE
    v_missing_photos integer;
BEGIN
    SELECT count(*) INTO v_missing_photos 
    FROM doctors 
    WHERE photo_url IS NULL 
       OR photo_url NOT LIKE '/media/doctors/doctor-%.jpg';
    IF v_missing_photos > 0 THEN
        RAISE EXCEPTION 'V83 migration assertion failed: % doctors have non-standard photo_url', v_missing_photos;
    END IF;
END $$;
