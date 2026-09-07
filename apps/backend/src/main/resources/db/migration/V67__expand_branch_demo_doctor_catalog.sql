-- Clearly labelled fictional profiles, one per active specialty at each active branch.
-- Do not infer real affiliations, credentials, reviews or clinical experience.
CREATE TEMP TABLE branch_demo_doctor_seed ON COMMIT DROP AS
SELECT md5('branch-demo-doctor:' || b.id::text || ':' || s.id::text)::uuid AS id,
       b.id AS branch_id, s.id AS specialty_id,
       'demo-bs-' || b.id::text || '-' || s.id::text AS slug,
       s.name AS specialty_name, b.name AS branch_name,
       row_number() OVER (PARTITION BY b.id ORDER BY s.slug) AS ordinal
FROM branches b CROSS JOIN specialties s
WHERE b.active AND s.active;

INSERT INTO doctors (id, full_name, slug, bio, active)
SELECT id,
       'Bác sĩ mẫu ' || ordinal || ' - ' || left(specialty_name, 100),
       slug,
       'DỮ LIỆU MINH HỌA: Hồ sơ giả lập phục vụ thử nghiệm tìm kiếm và đặt lịch, '
       || 'không đại diện cho bác sĩ thật hay xác nhận nhân sự của cơ sở. '
       || 'Chuyên khoa: ' || specialty_name || '. Cơ sở mẫu: ' || branch_name || '. '
       || 'Lịch thử nghiệm từ thứ Hai đến thứ Sáu, sáng 08:00-11:30, chiều 13:30-17:00. '
       || 'Mỗi khung hẹn 30 phút. Không dùng hồ sơ này để quyết định khám chữa bệnh.',
       true
FROM branch_demo_doctor_seed
ON CONFLICT DO NOTHING;

INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT md5('demo-branch:' || id::text)::uuid, id, branch_id
FROM branch_demo_doctor_seed
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT md5('demo-specialty:' || id::text)::uuid, id, specialty_id
FROM branch_demo_doctor_seed
ON CONFLICT DO NOTHING;

INSERT INTO doctor_schedules
    (id, doctor_id, branch_id, day_of_week, start_time, end_time,
     slot_duration_minutes, effective_from, active)
SELECT md5('demo-shift:' || seed.id::text || ':' || day_num || ':' || shift.start_time)::uuid,
       seed.id, seed.branch_id, day_num, shift.start_time, shift.end_time,
       30, DATE '2026-01-01', true
FROM branch_demo_doctor_seed seed
CROSS JOIN generate_series(1, 5) AS day_num
CROSS JOIN (VALUES (TIME '08:00', TIME '11:30'), (TIME '13:30', TIME '17:00'))
    AS shift(start_time, end_time)
ON CONFLICT DO NOTHING;
