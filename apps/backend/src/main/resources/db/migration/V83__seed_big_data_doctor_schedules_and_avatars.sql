-- ==========================================================================
-- V83__seed_big_data_doctor_schedules_and_avatars.sql
-- 1. Ensure 100% of doctors have local curated portraits (no NULLs or Unsplash)
-- 2. Ensure 100% of active doctors are assigned to active hospital branches
-- 3. Seed comprehensive Big Data recurring schedules for all 7 days (Mon-Sun)
--    with morning (08:00-12:00) and afternoon (13:30-17:30) 30-minute slots.
-- ==========================================================================

-- 1. Remediate doctor photo_url to reliable local clinical portraits
UPDATE doctors
SET photo_url = '/media/doctors/doctor-' || ((abs(hashtext(id::text)::bigint) % 11) + 1) || '.jpg'
WHERE photo_url IS NULL OR btrim(photo_url) = '' OR photo_url LIKE '%unsplash%';

-- 2. Ensure every active doctor is linked to at least one active branch
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
      SELECT 1 FROM doctor_branches db WHERE db.doctor_id = d.id
  )
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

-- 3. Seed comprehensive Big Data recurring schedules (Mon through Sun, morning + afternoon)
INSERT INTO doctor_schedules (
    id, doctor_id, branch_id, day_of_week, start_time, end_time,
    slot_duration_minutes, effective_from, active
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
WHERE NOT EXISTS (
    SELECT 1 FROM doctor_schedules ds
    WHERE ds.doctor_id = db.doctor_id
      AND ds.branch_id = db.branch_id
      AND ds.day_of_week = day_num
      AND ds.active = true
      AND (
          (ds.start_time <= shift.start_time AND ds.end_time > shift.start_time)
          OR (ds.start_time < shift.end_time AND ds.end_time >= shift.end_time)
          OR (shift.start_time <= ds.start_time AND shift.end_time >= ds.end_time)
      )
)
ON CONFLICT (id) DO NOTHING;
