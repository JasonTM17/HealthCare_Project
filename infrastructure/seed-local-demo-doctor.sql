-- Local demo only: the login page's quick-login "Bác sĩ" button signs in as
-- doctor@healthcare.com, so that persona must own the populated demo profile.
-- The compose seed binds that profile to doctor@healthcare.local; swap them so
-- both personas keep an ACTIVE doctors row (uq_doctors_user_id allows one each).
UPDATE doctors SET user_id = NULL
WHERE user_id IN (SELECT id FROM users WHERE email IN ('doctor@healthcare.com', 'doctor@healthcare.local'));

UPDATE doctors SET user_id = (SELECT id FROM users WHERE email = 'doctor@healthcare.com'), active = TRUE
WHERE slug = 'nguyen-minh-khoi'
  AND EXISTS (SELECT 1 FROM users WHERE email = 'doctor@healthcare.com');

UPDATE doctors SET user_id = (SELECT id FROM users WHERE email = 'doctor@healthcare.local'), active = TRUE
WHERE id = '30000000-0000-0000-0000-000000000005'
  AND EXISTS (SELECT 1 FROM users WHERE email = 'doctor@healthcare.local');

-- Appointments relative to "today" (Asia/Ho_Chi_Minh) so the doctor dashboard always
-- has work: IN_PROGRESS rows expose the "Ghi nhận kết quả khám" action. Idempotent:
-- fixed booking codes are re-dated on every run instead of piling up new rows.
WITH doc AS (
  SELECT d.id FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.email = 'doctor@healthcare.com'
), today AS (
  SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d
), plan(code, day_offset, start_t, status, patient_id, reason) AS (
  VALUES
    ('DEMO-LIVE-01', 0, TIME '07:00', 'IN_PROGRESS', '90000000-0000-0000-0000-000000000201'::uuid, 'Đau ngực nhẹ khi gắng sức, khám tim mạch định kỳ'),
    ('DEMO-LIVE-02', 0, TIME '07:30', 'IN_PROGRESS', '90000000-0000-0000-0000-000000000202'::uuid, 'Hồi hộp, khó ngủ kéo dài hai tuần'),
    ('DEMO-LIVE-03', 0, TIME '08:00', 'CHECKED_IN',  '90000000-0000-0000-0000-000000000203'::uuid, 'Đau đầu âm ỉ, huyết áp tăng nhẹ'),
    ('DEMO-LIVE-04', 0, TIME '15:30', 'CONFIRMED',   '90000000-0000-0000-0000-000000000204'::uuid, 'Tái khám sau điều trị viêm dạ dày'),
    ('DEMO-LIVE-05', 1, TIME '09:30', 'CONFIRMED',   '90000000-0000-0000-0000-000000000205'::uuid, 'Kiểm tra đường huyết và mỡ máu'),
    ('DEMO-LIVE-06', 1, TIME '10:30', 'CONFIRMED',   '90000000-0000-0000-0000-000000000206'::uuid, 'Ho kéo dài, khó thở về đêm'),
    ('DEMO-LIVE-07', 2, TIME '08:00', 'CONFIRMED',   '90000000-0000-0000-0000-000000000013'::uuid, 'Tư vấn chế độ ăn cho người tiểu đường'),
    ('DEMO-LIVE-08', 3, TIME '14:30', 'CONFIRMED',   '90000000-0000-0000-0000-000000000014'::uuid, 'Đau khớp gối khi leo cầu thang')
)
INSERT INTO appointments (id, booking_code, patient_id, doctor_id, appointment_date, start_time, end_time,
                          appointment_time, status, payment_status, reason_for_visit)
SELECT gen_random_uuid(), p.code, p.patient_id, doc.id, today.d + p.day_offset,
       p.start_t, p.start_t + INTERVAL '30 minutes',
       ((today.d + p.day_offset) + p.start_t) AT TIME ZONE 'Asia/Ho_Chi_Minh',
       p.status, 'PAID', p.reason
FROM plan p, doc, today
WHERE EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = p.patient_id)
ON CONFLICT (booking_code) DO UPDATE SET
  doctor_id = EXCLUDED.doctor_id,
  appointment_date = EXCLUDED.appointment_date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  appointment_time = EXCLUDED.appointment_time,
  status = EXCLUDED.status,
  payment_status = EXCLUDED.payment_status,
  reason_for_visit = EXCLUDED.reason_for_visit;
