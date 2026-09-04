-- V58__seed_healthcare_com_demo_users.sql
-- Seed & align demo accounts matching frontend login presets:
-- patient@healthcare.com / HealthCare@2026
-- doctor@healthcare.com / HealthCare@2026
-- admin@healthcare.com / HealthCare@2026
-- Hash for HealthCare@2026: $2b$10$LAxE79LzSUkiEFBWG2jgs.CUR71eRR.GEk9yJshuJy5OccgmyQB2y

-- 1. Upsert demo users with HealthCare@2026 password hash
INSERT INTO users (id, email, password_hash, display_name, status) VALUES
    ('90000000-0000-0000-0000-000000000021', 'patient@healthcare.com', '$2b$10$LAxE79LzSUkiEFBWG2jgs.CUR71eRR.GEk9yJshuJy5OccgmyQB2y', 'Nguyễn Văn An', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000023', 'doctor@healthcare.com', '$2b$10$LAxE79LzSUkiEFBWG2jgs.CUR71eRR.GEk9yJshuJy5OccgmyQB2y', 'ThS.BS Trần Thu Hà', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000025', 'admin@healthcare.com', '$2b$10$LAxE79LzSUkiEFBWG2jgs.CUR71eRR.GEk9yJshuJy5OccgmyQB2y', 'Quản trị viên Hệ thống', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    status = EXCLUDED.status;

-- Also update existing .local demo users to accept HealthCare@2026
UPDATE users SET password_hash = '$2b$10$LAxE79LzSUkiEFBWG2jgs.CUR71eRR.GEk9yJshuJy5OccgmyQB2y'
WHERE email IN ('patient@healthcare.local', 'doctor@healthcare.local', 'admin@healthcare.local');

-- 2. Assign user roles
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('patient@healthcare.com', 'PATIENT'),
    ('doctor@healthcare.com', 'DOCTOR'),
    ('admin@healthcare.com', 'ADMIN'),
    ('patient@healthcare.local', 'PATIENT'),
    ('doctor@healthcare.local', 'DOCTOR'),
    ('admin@healthcare.local', 'ADMIN')
) AS accounts(email, role_code)
JOIN users u ON u.email = accounts.email
JOIN roles r ON r.code = accounts.role_code
ON CONFLICT DO NOTHING;

-- 3. Update or insert patient_profile for patient@healthcare.com
UPDATE patient_profiles
SET blood_type = COALESCE(blood_type, 'A+'),
    medical_history = COALESCE(medical_history, 'Tiền sử viêm xoang mạn tính nhẹ, không có bệnh tim mạch hay tiểu đường.'),
    allergies = COALESCE(allergies, 'Dị ứng Aspirin nhẹ (nổi mẩn ngứa), không dị ứng thực phẩm.'),
    patient_tier = COALESCE(patient_tier, 'GOLD'),
    ai_credits = GREATEST(COALESCE(ai_credits, 0), 85)
WHERE email = 'patient@healthcare.com'
   OR user_id IN (SELECT id FROM users WHERE email = 'patient@healthcare.com');

-- If no profile existed at all, insert one
INSERT INTO patient_profiles (
    id, full_name, phone, email, user_id, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, blood_type, medical_history, allergies, patient_tier, ai_credits
)
SELECT
    '90000000-0000-0000-0000-000000000022',
    'Nguyễn Văn An',
    '0909123456',
    'patient@healthcare.com',
    u.id,
    '1991-05-14',
    'MALE',
    '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    'Nguyễn Thị Hoa (Vợ)',
    '0909999888',
    'A+',
    'Tiền sử viêm xoang mạn tính nhẹ, không có bệnh tim mạch hay tiểu đường.',
    'Dị ứng Aspirin nhẹ (nổi mẩn ngứa), không dị ứng thực phẩm.',
    'GOLD',
    85
FROM users u
WHERE u.email = 'patient@healthcare.com'
  AND NOT EXISTS (
      SELECT 1 FROM patient_profiles p WHERE p.user_id = u.id OR p.email = 'patient@healthcare.com'
  );

-- 4. Update doctor credits and link user account if not yet linked
UPDATE doctors
SET ai_credits = GREATEST(COALESCE(ai_credits, 0), 150)
WHERE user_id IN (SELECT id FROM users WHERE email IN ('doctor@healthcare.com', 'doctor@healthcare.local'))
   OR id = '30000000-0000-0000-0000-000000000005';
