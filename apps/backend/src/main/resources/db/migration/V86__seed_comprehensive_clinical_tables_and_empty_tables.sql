-- V86__seed_comprehensive_clinical_tables_and_empty_tables.sql
-- Idempotent, transaction-safe seed script to populate all empty & sparse tables with rich clinical data.

DO $$
BEGIN

-- 1. SEED USERS & PATIENT PROFILES

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000101', 'nguyenvancuong.hn@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Nguyễn Văn Cường', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000101', 'Nguyễn Văn Cường', '0912345601', 'nguyenvancuong.hn@gmail.com', '1985-04-12', 'MALE', 'Số 12 Phố Huế, Hoàn Kiếm, Hà Nội', 'Người nhà Nguyễn Văn Cường', '0988888801', 'Tiền sử Tăng huyết áp 3 năm', 'Dị ứng Penicillin', 'A+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000102', 'maiphuong.tran88@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Trần Thị Mai Phương', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000102', 'Trần Thị Mai Phương', '0912345602', 'maiphuong.tran88@gmail.com', '1988-09-23', 'FEMALE', '25 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Người nhà Trần Thị Mai Phương', '0988888802', 'Viêm dạ dày Hp (+)', 'Không có', 'O+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000103', 'hoanglong.le92@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Lê Hoàng Long', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0000-000000000103', 'Lê Hoàng Long', '0912345603', 'hoanglong.le92@gmail.com', '1992-01-15', 'MALE', '108 Lê Duẩn, Đống Đa, Hà Nội', 'Người nhà Lê Hoàng Long', '0988888803', 'Thoái hóa đốt sống cổ C5-C6', 'Dị ứng phấn hoa', 'B+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000104', 'thuha.pham95@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Phạm Thu Hà', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000204', '90000000-0000-0000-0000-000000000104', 'Phạm Thu Hà', '0912345604', 'thuha.pham95@gmail.com', '1995-11-30', 'FEMALE', '45 Cầu Giấy, Cầu Giấy, Hà Nội', 'Người nhà Phạm Thu Hà', '0988888804', 'Viêm da dị ứng thời tiết', 'Hải sản (tôm, cua)', 'AB+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000105', 'ducminh.vu80@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Vũ Đức Minh', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000205', '90000000-0000-0000-0000-000000000105', 'Vũ Đức Minh', '0912345605', 'ducminh.vu80@gmail.com', '1980-06-18', 'MALE', '72 Trần Phú, Hà Đông, Hà Nội', 'Người nhà Vũ Đức Minh', '0988888805', 'Đái tháo đường Type 2 kiểm soát tốt', 'Không có', 'O+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000106', 'thanhhuong.doan90@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Đoàn Thanh Hương', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000206', '90000000-0000-0000-0000-000000000106', 'Đoàn Thanh Hương', '0912345606', 'thanhhuong.doan90@gmail.com', '1990-03-08', 'FEMALE', '88 Láng Hạ, Đống Đa, Hà Nội', 'Người nhà Đoàn Thanh Hương', '0988888806', 'Thiếu máu nhẹ thiếu sắt', 'Aspirin', 'A+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000107', 'quocanh.bui87@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Bùi Quốc Anh', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000207', '90000000-0000-0000-0000-000000000107', 'Bùi Quốc Anh', '0912345607', 'quocanh.bui87@gmail.com', '1987-12-05', 'MALE', '16 Hoàng Cầu, Đống Đa, Hà Nội', 'Người nhà Bùi Quốc Anh', '0988888807', 'Rối loạn lipid máu', 'Không có', 'B+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000108', 'thuynga.dang94@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Đặng Thúy Nga', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000208', '90000000-0000-0000-0000-000000000108', 'Đặng Thúy Nga', '0912345608', 'thuynga.dang94@gmail.com', '1994-08-19', 'FEMALE', '34 Hai Bà Trưng, Hoàn Kiếm, Hà Nội', 'Người nhà Đặng Thúy Nga', '0988888808', 'Hội chứng ruột kích thích (IBS)', 'Sữa bò (không dung nạp lactose)', 'O-', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000109', 'minhtuan.hoang82@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Hoàng Minh Tuấn', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-000000000209', '90000000-0000-0000-0000-000000000109', 'Hoàng Minh Tuấn', '0912345609', 'minhtuan.hoang82@gmail.com', '1982-05-14', 'MALE', '56 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', 'Người nhà Hoàng Minh Tuấn', '0988888809', 'Gout mạn tính, axit uric cao', 'Không có', 'A+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000010a', 'kimngan.ly96@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Lý Kim Ngân', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000020a', '90000000-0000-0000-0000-00000000010a', 'Lý Kim Ngân', '0912345610', 'kimngan.ly96@gmail.com', '1996-10-27', 'FEMALE', '120 Cách Mạng Tháng 8, Quận 3, TP.HCM', 'Người nhà Lý Kim Ngân', '0988888810', 'Hen phế quản dị ứng nhẹ', 'Lông mèo', 'AB-', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000010b', 'thanhdat.vo78@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Võ Thành Đạt', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-00000000010b', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000020b', '90000000-0000-0000-0000-00000000010b', 'Võ Thành Đạt', '0912345611', 'thanhdat.vo78@gmail.com', '1978-02-28', 'MALE', '205 Điện Biên Phủ, Bình Thạnh, TP.HCM', 'Người nhà Võ Thành Đạt', '0988888811', 'Hẹp hở van tim nhẹ 1/4', 'Không có', 'O+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, email_verified_at, created_at, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000010c', 'anhtuyet.duong89@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Dương Ánh Tuyết', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP)
  ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO user_roles (user_id, role_id)
  VALUES ('90000000-0000-0000-0000-00000000010c', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, email, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, blood_type, patient_tier, ai_credits, updated_at)
  VALUES ('90000000-0000-0000-0000-00000000020c', '90000000-0000-0000-0000-00000000010c', 'Dương Ánh Tuyết', '0912345612', 'anhtuyet.duong89@gmail.com', '1989-07-11', 'FEMALE', '92 Phan Xích Long, Phú Nhuận, TP.HCM', 'Người nhà Dương Ánh Tuyết', '0988888812', 'Viêm mũi dị ứng mạn', 'Kháng sinh nhóm Sulfonamide', 'B+', 'STANDARD', 50, CURRENT_TIMESTAMP)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 2. SEED PERMISSIONS & ROLE_PERMISSIONS
  INSERT INTO permissions (id, code, description, created_at) VALUES
    ('00000000-0000-0000-0001-000000000001', 'APPOINTMENT_READ', 'Xem danh sách và chi tiết lịch hẹn', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000002', 'APPOINTMENT_WRITE', 'Tạo và cập nhật thông tin lịch hẹn', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000003', 'APPOINTMENT_CANCEL', 'Hủy lịch hẹn khám bệnh', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000004', 'CLINICAL_RECORD_READ', 'Xem hồ sơ bệnh án điện tử và kết quả', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000005', 'CLINICAL_RECORD_WRITE', 'Lập và ký duyệt hồ sơ bệnh án', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000006', 'PRESCRIPTION_READ', 'Tra cứu đơn thuốc và hướng dẫn sử dụng', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000007', 'PRESCRIPTION_WRITE', 'Kê đơn thuốc điều trị ngoại trú', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000008', 'CONSULTATION_READ', 'Tham gia và xem phiên tư vấn trực tuyến', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000009', 'CONSULTATION_WRITE', 'Gửi tin nhắn tư vấn y tế', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000010', 'DOCTOR_MANAGE', 'Quản lý danh sách bác sĩ và ca trực', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000011', 'PAYMENT_MANAGE', 'Xác nhận và đối soát thanh toán viện phí', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0001-000000000012', 'SYSTEM_ADMIN', 'Quản trị toàn quyền hệ thống HealthCare', CURRENT_TIMESTAMP)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
  WHERE code IN ('APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'APPOINTMENT_CANCEL', 'CLINICAL_RECORD_READ', 'PRESCRIPTION_READ', 'CONSULTATION_READ', 'CONSULTATION_WRITE')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE code IN ('APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'CLINICAL_RECORD_READ', 'CLINICAL_RECORD_WRITE', 'PRESCRIPTION_READ', 'PRESCRIPTION_WRITE', 'CONSULTATION_READ', 'CONSULTATION_WRITE')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. USER_PREFERENCES & NOTIFICATION_PREFERENCES
  INSERT INTO user_preferences (user_id, email_notifications, appointment_reminders, marketing_emails, locale, timezone)
  SELECT u.id, true, true, false, 'vi-VN', 'Asia/Ho_Chi_Minh'
  FROM users u
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO notification_preferences (user_id, category, channel, enabled)
  SELECT u.id, categories.category, channels.channel,
         CASE WHEN categories.category = 'MARKETING' THEN false ELSE true END
  FROM users u
  CROSS JOIN (VALUES
      ('SECURITY'), ('APPOINTMENT'), ('PAYMENT'), ('CLINICAL_UPDATE'),
      ('CONSULTATION'), ('CARE_PLAN'), ('MARKETING')
  ) AS categories(category)
  CROSS JOIN (VALUES ('EMAIL'), ('IN_APP')) AS channels(channel)
  ON CONFLICT (user_id, category, channel) DO NOTHING;

-- 4. APPOINTMENTS & APPOINTMENT_ACCOUNT_CLAIMS

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000001', 'HC-BK-20260901-100', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '14 days', '08:30:00', '09:00:00', (CURRENT_DATE - INTERVAL '14 days') + TIME '08:30:00', 'COMPLETED', 'PAID', 'Khám định kỳ huyết áp và tầm soát tim mạch', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000001', '90000000-0000-0000-0002-000000000001', '90000000-0000-0000-0000-000000000101', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000002', 'HC-BK-20260902-101', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '13 days', '14:00:00', '14:30:00', (CURRENT_DATE - INTERVAL '13 days') + TIME '14:00:00', 'COMPLETED', 'PAID', 'Tái khám viêm loét dạ dày tá tràng Hp (+)', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000002', '90000000-0000-0000-0002-000000000002', '90000000-0000-0000-0000-000000000102', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000003', 'HC-BK-20260903-102', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '12 days', '08:30:00', '09:00:00', (CURRENT_DATE - INTERVAL '12 days') + TIME '08:30:00', 'COMPLETED', 'PAID', 'Đau nhức khớp gối phải khi lên xuống cầu thang', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000003', '90000000-0000-0000-0002-000000000003', '90000000-0000-0000-0000-000000000103', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000004', 'HC-BK-20260904-103', '90000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '11 days', '14:00:00', '14:30:00', (CURRENT_DATE - INTERVAL '11 days') + TIME '14:00:00', 'COMPLETED', 'PAID', 'Phát ban mẩn ngứa dị ứng vùng cánh tay', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000004', '90000000-0000-0000-0002-000000000004', '90000000-0000-0000-0000-000000000104', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000005', 'HC-BK-20260905-104', '90000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '10 days', '08:30:00', '09:00:00', (CURRENT_DATE - INTERVAL '10 days') + TIME '08:30:00', 'COMPLETED', 'PAID', 'Đau đầu chóng mặt từng cơn vào buổi sáng', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000005', '90000000-0000-0000-0002-000000000005', '90000000-0000-0000-0000-000000000105', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000006', 'HC-BK-20260906-105', '90000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000001', '7765688c-354a-229a-6704-e4e460ccf3fa', '5c20abac-9079-f9db-2819-3cbf167603b5', CURRENT_DATE - INTERVAL '9 days', '14:00:00', '14:30:00', (CURRENT_DATE - INTERVAL '9 days') + TIME '14:00:00', 'COMPLETED', 'PAID', 'Tư vấn chế độ dinh dưỡng kiểm soát đái tháo đường', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000006', '90000000-0000-0000-0002-000000000006', '90000000-0000-0000-0000-000000000106', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000007', 'HC-BK-20260907-106', '90000000-0000-0000-0000-000000000207', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '535f4437-1f68-4926-14c8-2e9d29a4f684', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd', CURRENT_DATE - INTERVAL '8 days', '08:30:00', '09:00:00', (CURRENT_DATE - INTERVAL '8 days') + TIME '08:30:00', 'COMPLETED', 'PAID', 'Khám tai mũi họng viêm họng sốt nhẹ', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000007', '90000000-0000-0000-0002-000000000007', '90000000-0000-0000-0000-000000000107', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000008', 'HC-BK-20260908-107', '90000000-0000-0000-0000-000000000208', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd', CURRENT_DATE - INTERVAL '7 days', '14:00:00', '14:30:00', (CURRENT_DATE - INTERVAL '7 days') + TIME '14:00:00', 'COMPLETED', 'PAID', 'Khám sức khỏe tổng quát định kỳ doanh nghiệp', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000008', '90000000-0000-0000-0002-000000000008', '90000000-0000-0000-0000-000000000108', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-000000000009', 'HC-BK-20260909-108', '90000000-0000-0000-0000-000000000209', '0467b23c-312e-25b9-af98-761fd1fffa9f', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'd45a7cb5-269a-f76f-0554-ad3da3906c51', CURRENT_DATE + INTERVAL '1 days', '08:30:00', '09:00:00', (CURRENT_DATE + INTERVAL '1 days') + TIME '08:30:00', 'CONFIRMED', 'PAID', 'Khám định kỳ huyết áp và tầm soát tim mạch', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-000000000009', '90000000-0000-0000-0002-000000000009', '90000000-0000-0000-0000-000000000109', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000a', 'HC-BK-20260910-109', '90000000-0000-0000-0000-00000000020a', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', 'd45a7cb5-269a-f76f-0554-ad3da3906c51', CURRENT_DATE + INTERVAL '2 days', '14:00:00', '14:30:00', (CURRENT_DATE + INTERVAL '2 days') + TIME '14:00:00', 'CONFIRMED', 'PAID', 'Tái khám viêm loét dạ dày tá tràng Hp (+)', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000a', '90000000-0000-0000-0002-00000000000a', '90000000-0000-0000-0000-00000000010a', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000b', 'HC-BK-20260911-110', '90000000-0000-0000-0000-00000000020b', '05152036-18cd-98a6-92a3-cfc64f6651dd', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2', CURRENT_DATE + INTERVAL '3 days', '08:30:00', '09:00:00', (CURRENT_DATE + INTERVAL '3 days') + TIME '08:30:00', 'CONFIRMED', 'PAID', 'Đau nhức khớp gối phải khi lên xuống cầu thang', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000b', '90000000-0000-0000-0002-00000000000b', '90000000-0000-0000-0000-00000000010b', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000c', 'HC-BK-20260912-111', '90000000-0000-0000-0000-00000000020c', '05152036-18cd-98a6-92a3-cfc64f6651dd', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2', CURRENT_DATE + INTERVAL '4 days', '14:00:00', '14:30:00', (CURRENT_DATE + INTERVAL '4 days') + TIME '14:00:00', 'CONFIRMED', 'PAID', 'Phát ban mẩn ngứa dị ứng vùng cánh tay', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000c', '90000000-0000-0000-0002-00000000000c', '90000000-0000-0000-0000-00000000010c', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000d', 'HC-BK-20260913-112', '90000000-0000-0000-0000-000000000201', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'd898a94d-f778-a09e-a99c-060ebbbfd35e', CURRENT_DATE + INTERVAL '5 days', '08:30:00', '09:00:00', (CURRENT_DATE + INTERVAL '5 days') + TIME '08:30:00', 'CONFIRMED', 'PAID', 'Đau đầu chóng mặt từng cơn vào buổi sáng', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000d', '90000000-0000-0000-0002-00000000000d', '90000000-0000-0000-0000-000000000101', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000e', 'HC-BK-20260914-113', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '7f80619b-9ece-f8d3-add2-12c4e6de963d', CURRENT_DATE + INTERVAL '6 days', '14:00:00', '14:30:00', (CURRENT_DATE + INTERVAL '6 days') + TIME '14:00:00', 'CANCELLED', 'UNPAID', 'Tư vấn chế độ dinh dưỡng kiểm soát đái tháo đường', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000e', '90000000-0000-0000-0002-00000000000e', '90000000-0000-0000-0000-000000000102', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO appointments (id, booking_code, patient_id, doctor_id, branch_id, specialty_id, appointment_date, start_time, end_time, appointment_time, status, payment_status, reason_for_visit, notes, has_insurance, otp_attempts, created_at)
  VALUES ('90000000-0000-0000-0002-00000000000f', 'HC-BK-20260915-114', '90000000-0000-0000-0000-000000000203', '05866f27-98b4-7fd9-4e46-2f281ede4098', '535f4437-1f68-4926-14c8-2e9d29a4f684', '7f80619b-9ece-f8d3-add2-12c4e6de963d', CURRENT_DATE + INTERVAL '7 days', '08:30:00', '09:00:00', (CURRENT_DATE + INTERVAL '7 days') + TIME '08:30:00', 'CANCELLED', 'UNPAID', 'Khám tai mũi họng viêm họng sốt nhẹ', 'Bệnh nhân có mặt đúng giờ, tuân thủ hướng dẫn khám bệnh.', true, 1, CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('90000000-0000-0000-0003-00000000000f', '90000000-0000-0000-0002-00000000000f', '90000000-0000-0000-0000-000000000103', 'BOOKING_OTP', CURRENT_TIMESTAMP - INTERVAL '1 days')
  ON CONFLICT (appointment_id) DO NOTHING;

-- 5. AUTH_OTP_CHALLENGES

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000001', '90000000-0000-0000-0000-000000000101', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000002', '90000000-0000-0000-0000-000000000102', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'PASSWORD_RESET', CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000003', '90000000-0000-0000-0000-000000000103', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '8 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '8 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000004', '90000000-0000-0000-0000-000000000104', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'PASSWORD_RESET', CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000005', '90000000-0000-0000-0000-000000000105', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '6 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '6 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000006', '90000000-0000-0000-0000-000000000106', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'PASSWORD_RESET', CURRENT_TIMESTAMP - INTERVAL '5 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '5 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000007', '90000000-0000-0000-0000-000000000107', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'EMAIL_VERIFICATION', CURRENT_TIMESTAMP - INTERVAL '4 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '4 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_otp_challenges (id, user_id, otp_hash, purpose, expires_at, attempts, consumed_at, created_at)
  VALUES ('90000000-0000-0000-0004-000000000008', '90000000-0000-0000-0000-000000000108', '$2a$10$w0u3Pz.xM6tNqvIeT9cEw.yGzN.3Kj2V0YJ9N4L3m.8hXqK9lKk7W', 'PASSWORD_RESET', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '15 minutes', 1, CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

-- 6. DOCTOR_SCHEDULE_EXCEPTIONS

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000001', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '7188f796-3d10-ca33-3d04-bfc7dab3932c', CURRENT_DATE + INTERVAL '3 days', 'LEAVE', NULL, NULL, 'Tham dự Hội nghị Tim mạch Quốc gia thường niên')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000002', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', CURRENT_DATE + INTERVAL '4 days', 'CUSTOM_HOURS', '07:30:00', '11:30:00', 'Ca khám ngoại trú chuyên gia buổi sáng')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000003', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', CURRENT_DATE + INTERVAL '5 days', 'LEAVE', NULL, NULL, 'Tham dự Hội nghị Tim mạch Quốc gia thường niên')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000004', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', CURRENT_DATE + INTERVAL '6 days', 'CUSTOM_HOURS', '07:30:00', '11:30:00', 'Ca khám ngoại trú chuyên gia buổi sáng')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000005', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '83d56555-dc7c-f749-7271-04e0d1843da1', CURRENT_DATE + INTERVAL '7 days', 'LEAVE', NULL, NULL, 'Tham dự Hội nghị Tim mạch Quốc gia thường niên')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason)
  VALUES ('90000000-0000-0000-0005-000000000006', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '7765688c-354a-229a-6704-e4e460ccf3fa', CURRENT_DATE + INTERVAL '8 days', 'CUSTOM_HOURS', '07:30:00', '11:30:00', 'Ca khám ngoại trú chuyên gia buổi sáng')
  ON CONFLICT (id) DO NOTHING;

-- 7. MEDICAL RECORDS, DIAGNOSTIC ORDERS, RESULTS, PRESCRIPTIONS

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000001', '90000000-0000-0000-0002-000000000001', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', 'I10', 'Tăng huyết áp vô căn (nguyên phát)', 'Tăng huyết áp độ 1 - Nguy cơ tim mạch trung bình', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 142, 88, 76, 36.6, 68.5, 168, 'Dùng thuốc hạ áp hằng ngày, chế độ ăn giảm muối DASH, tái khám sau 4 tuần', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000001', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000001', 'Tổng phân tích tế bào máu ngoại vi (CBC) & Điện tâm đồ', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000001', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', 'Tổng phân tích tế bào máu ngoại vi (CBC) & Điện tâm đồ', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '14 days', '90000000-0000-0000-0007-000000000001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000001', '90000000-0000-0000-0006-000000000001', 'RX-HC-20260901-100', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', 'Tăng huyết áp độ 1 - Nguy cơ tim mạch trung bình', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000001', '90000000-0000-0000-0009-000000000001', 'Amlodipine 5mg', 'Amlodipine besylate', '5mg', 'Viên', 'Uống 1 viên vào mỗi buổi sáng sau ăn', 30, 30, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000002', '90000000-0000-0000-0002-000000000002', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản', 'Trào ngược dạ dày thực quản (GERD) độ A - Viêm trợt hang vị', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 120, 78, 72, 36.5, 54, 158, 'Thuốc ức chế bơm Proton (PPI) 8 tuần, kiêng cay chua nóng, không nằm ngay sau ăn', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000002', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000002', 'Nội soi thực quản - dạ dày - tá tràng & Test Hp', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000002', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', 'Nội soi thực quản - dạ dày - tá tràng & Test Hp', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '13 days', '90000000-0000-0000-0007-000000000002')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000002', '90000000-0000-0000-0006-000000000002', 'RX-HC-20260902-101', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', 'Trào ngược dạ dày thực quản (GERD) độ A - Viêm trợt hang vị', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000002', '90000000-0000-0000-0009-000000000002', 'Esomeprazole 40mg', 'Esomeprazole magnesium', '40mg', 'Viên', 'Uống 1 viên trước ăn sáng 30 phút', 28, 28, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000003', '90000000-0000-0000-0002-000000000003', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'E11.9', 'Đái tháo đường típ 2 không có biến chứng', 'Đái tháo đường type 2 mới phát hiện - Rối loạn lipid máu', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 130, 82, 80, 36.7, 74, 170, 'Metformin đơn trị liệu kết hợp kiểm soát khẩu phần tinh bột, theo dõi đường huyết đói', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000003', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000003', 'Định lượng Glucose máu và HbA1c', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000003', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'Định lượng Glucose máu và HbA1c', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '12 days', '90000000-0000-0000-0007-000000000003')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000003', '90000000-0000-0000-0006-000000000003', 'RX-HC-20260903-102', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'Đái tháo đường type 2 mới phát hiện - Rối loạn lipid máu', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000003', '90000000-0000-0000-0009-000000000003', 'Metformin 850mg', 'Metformin hydrochloride', '850mg', 'Viên', 'Uống 1 viên sau bữa ăn chính (sáng - tối)', 30, 60, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000004', '90000000-0000-0000-0002-000000000004', '90000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000001', 'M17.0', 'Thoái hóa khớp gối nguyên phát, hai bên', 'Thoái hóa khớp gối nguyên phát độ 2 theo Kellgren-Lawrence', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 125, 80, 74, 36.4, 62, 160, 'Thuốc chống viêm giảm đau NSAID ngắn ngày, bổ sung dưỡng chất khớp, tập vật lý trị liệu', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000004', '90000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000004', 'Chụp X-quang khớp gối thẳng nghiêng 2 bên', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000004', '90000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000001', 'Chụp X-quang khớp gối thẳng nghiêng 2 bên', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '11 days', '90000000-0000-0000-0007-000000000004')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000004', '90000000-0000-0000-0006-000000000004', 'RX-HC-20260904-103', '90000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000001', 'Thoái hóa khớp gối nguyên phát độ 2 theo Kellgren-Lawrence', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000004', '90000000-0000-0000-0009-000000000004', 'Celecoxib 200mg', 'Celecoxib', '200mg', 'Viên', 'Uống 1 viên sau ăn sáng', 14, 14, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000005', '90000000-0000-0000-0002-000000000005', '90000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000001', 'J06.9', 'Nhiễm khuẩn đường hô hấp trên cấp, không xác định', 'Viêm mũi họng cấp tính do virus bội nhiễm', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 118, 75, 82, 37.8, 50, 155, 'Kháng sinh đường uống 7 ngày, giảm đau hạ sốt, súc họng nước muối sinh lý ấm', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000005', '90000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000005', 'Nội soi tai mũi họng & Chụp X-quang tim phổi thẳng', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000005', '90000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000001', 'Nội soi tai mũi họng & Chụp X-quang tim phổi thẳng', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '10 days', '90000000-0000-0000-0007-000000000005')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000005', '90000000-0000-0000-0006-000000000005', 'RX-HC-20260905-104', '90000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000001', 'Viêm mũi họng cấp tính do virus bội nhiễm', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000005', '90000000-0000-0000-0009-000000000005', 'Augmentin 1g', 'Amoxicillin / Clavulanic acid', '1000mg', 'Viên', 'Uống 1 viên mỗi 12 giờ sau ăn', 7, 14, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight_kg, height_cm, treatment_plan, doctor_notes, follow_up_date, created_at)
  VALUES ('90000000-0000-0000-0006-000000000006', '90000000-0000-0000-0002-000000000006', '90000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000001', 'L20.8', 'Viêm da cơ địa khác', 'Viêm da cơ địa thể bán cấp - Ngứa nhiều về đêm', 'Bệnh nhân cảm thấy mệt mỏi, triệu chứng kéo dài', 115, 75, 70, 36.5, 48, 156, 'Dưỡng ẩm da thường xuyên, bôi Corticoid nhẹ ngắn hạn, tránh tiếp xúc xà phòng hóa chất', 'Bệnh nhân hợp tác tốt, giải thích rõ phương án điều trị.', CURRENT_DATE + INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (id, patient_id, doctor_id, appointment_id, test_name, notes, status, created_at)
  VALUES ('90000000-0000-0000-0007-000000000006', '90000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0002-000000000006', 'Soi tươi tìm nấm và ký sinh trùng da', 'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date, order_id)
  VALUES ('90000000-0000-0000-0008-000000000006', '90000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000001', 'Soi tươi tìm nấm và ký sinh trùng da', 'Kết quả xét nghiệm phù hợp với bệnh cảnh lâm sàng, các chỉ số trong giới hạn an toàn', CURRENT_DATE - INTERVAL '9 days', '90000000-0000-0000-0007-000000000006')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, general_advice, status, created_at)
  VALUES ('90000000-0000-0000-0009-000000000006', '90000000-0000-0000-0006-000000000006', 'RX-HC-20260906-105', '90000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000001', 'Viêm da cơ địa thể bán cấp - Ngứa nhiều về đêm', 'Uống thuốc đúng liều, đủ ngày theo đơn. Tái khám khi có dấu hiệu bất thường.', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (id, prescription_id, medication_name, active_ingredient, dosage, unit, frequency, duration_days, total_quantity, usage_note, created_at)
  VALUES ('90000000-0000-0000-000a-000000000006', '90000000-0000-0000-0009-000000000006', 'Desloratadine 5mg', 'Desloratadine', '5mg', 'Viên', 'Uống 1 viên vào buổi tối trước khi ngủ', 15, 15, 'Uống với nhiều nước, tuân thủ hướng dẫn bác sĩ.', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

-- 8. PATIENT CARE PLANS & ITEMS

  INSERT INTO patient_care_plans (id, patient_profile_id, appointment_id, doctor_id, title, status, starts_at, ends_at, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000b-000000000001', '90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0002-000000000001', '30000000-0000-0000-0000-000000000001', 'Chương trình Kiểm soát Huyết áp tại nhà & Chế độ ăn DASH (30 ngày)', 'OPEN', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '20 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (id, care_plan_id, patient_profile_id, appointment_id, doctor_id, sequence_number, goal, reminder, status, due_at, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000c-000000000001', '90000000-0000-0000-000b-000000000001', '90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0002-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'Đo huyết áp hằng ngày lúc 07:00 sáng trước khi uống thuốc', 'Uống thuốc Amlodipine 5mg đúng giờ mỗi sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('90000000-0000-0000-000c-000000000002', '90000000-0000-0000-000b-000000000001', '90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0002-000000000001', '30000000-0000-0000-0000-000000000001', 2, 'Đi bộ thể dục vừa sức 30 phút mỗi ngày', 'Hạn chế muối ăn dưới 5g/ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (id, patient_profile_id, appointment_id, doctor_id, title, status, starts_at, ends_at, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000b-000000000002', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0002-000000000002', '30000000-0000-0000-0000-000000000001', 'Kế hoạch Phục hồi Niêm mạc Dạ dày & Diệt trừ Vi khuẩn Hp (8 tuần)', 'OPEN', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '20 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (id, care_plan_id, patient_profile_id, appointment_id, doctor_id, sequence_number, goal, reminder, status, due_at, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000c-000000000003', '90000000-0000-0000-000b-000000000002', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0002-000000000002', '30000000-0000-0000-0000-000000000001', 1, 'Uống Esomeprazole đều đặn trước bữa ăn sáng 30 phút', 'Ăn chín uống sôi, không ăn sau 20h00 tối', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('90000000-0000-0000-000c-000000000004', '90000000-0000-0000-000b-000000000002', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0002-000000000002', '30000000-0000-0000-0000-000000000001', 2, 'Tái khám nội soi kiểm tra sau khi kết thúc đợt thuốc 8 tuần', 'Kiêng hoàn toàn rượu bia, cà phê và gia vị cay', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (id, patient_profile_id, appointment_id, doctor_id, title, status, starts_at, ends_at, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000b-000000000003', '90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0002-000000000003', '30000000-0000-0000-0000-000000000001', 'Kế hoạch Theo dõi Đường huyết & Vận động cho bệnh nhân Đái tháo đường Type 2', 'OPEN', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '20 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (id, care_plan_id, patient_profile_id, appointment_id, doctor_id, sequence_number, goal, reminder, status, due_at, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000c-000000000005', '90000000-0000-0000-000b-000000000003', '90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0002-000000000003', '30000000-0000-0000-0000-000000000001', 1, 'Đo đường huyết mao mạch trước ăn sáng 3 lần/tuần', 'Duy trì mức đường huyết đói từ 4.4 đến 7.0 mmol/L', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('90000000-0000-0000-000c-000000000006', '90000000-0000-0000-000b-000000000003', '90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0002-000000000003', '30000000-0000-0000-0000-000000000001', 2, 'Kiểm soát cân nặng và duy trì tập aerobic 150 phút/tuần', 'Bổ sung chất xơ từ rau xanh, giảm tinh bột tinh chế', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

-- 9. PATIENT CONSULTATION THREADS, PARTICIPANTS, MESSAGES, EVENTS, READ STATES & ATTACHMENTS

  INSERT INTO patient_consultation_threads (id, appointment_id, patient_profile_id, doctor_id, status, subject, consultation_open_until, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000d-000000000001', '90000000-0000-0000-0002-000000000001', '90000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', 'OPEN', 'Tư vấn điều chỉnh liều thuốc hạ huyết áp khi có hiện tượng choáng nhẹ', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id,
    assignment_permission, assignment_metadata, joined_at, retention_expires_at
  )
  VALUES
    ('90000000-0000-0000-000e-000000000001', '90000000-0000-0000-000d-000000000001', '90000000-0000-0000-0000-000000000101', 'PATIENT', NULL, 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days'),
    ('90000000-0000-0000-000e-000000000002', '90000000-0000-0000-000d-000000000001', '90000000-0000-0000-0000-000000000023', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (id, thread_id, sequence_number, author_user_id, author_participant_id, author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000f-000000000001', '90000000-0000-0000-000d-000000000001', 1, '90000000-0000-0000-0000-000000000101', '90000000-0000-0000-000e-000000000001', 'PATIENT', 'TEXT', 'Chào Bác sĩ, dạo gần đây mỗi khi đổi tư thế đứng dậy tôi cảm thấy hơi choáng váng nhẹ, xin bác sĩ hướng dẫn.', 'msg:90000000-0000-0000-000d-000000000001:1', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('90000000-0000-0000-000f-000000000002', '90000000-0000-0000-000d-000000000001', 2, '90000000-0000-0000-0000-000000000023', '90000000-0000-0000-000e-000000000002', 'DOCTOR', 'TEXT', 'Chào bạn, huyết áp đo gần nhất của bạn là bao nhiêu? Bạn nên đo lại huyết áp lúc nghỉ và ngồi dậy từ từ nhé.', 'msg:90000000-0000-0000-000d-000000000001:2', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  VALUES ('90000000-0000-0000-0020-000000000001', '90000000-0000-0000-000d-000000000001', '90000000-0000-0000-0000-000000000101', '90000000-0000-0000-000f-000000000002', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  VALUES ('90000000-0000-0000-0021-000000000001', '90000000-0000-0000-000d-000000000001', 'MESSAGE_SENT', '90000000-0000-0000-0000-000000000101', 'PATIENT', gen_random_uuid(), '{"message_id": "90000000-0000-0000-000f-000000000001"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_attachments (
    id, thread_id, message_id, private_object_key, actual_mime_type, declared_mime_type,
    size_bytes, sha256_hash, scan_status, scan_attempts, upload_status, upload_object_key,
    verified_object_key, scan_available_at, synthetic_fixture, retention_expires_at, created_at
  ) VALUES (
    '90000000-0000-0000-0022-000000000001', '90000000-0000-0000-000d-000000000001', '90000000-0000-0000-000f-000000000001',
    'private/consultations/90000000-0000-0000-000d-000000000001/verified/clinical_test_result_1.pdf',
    'application/pdf', 'application/pdf',
    204800, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'CLEAN', 1, 'UPLOADED',
    'consultations/upload/clinical_test_result_1.pdf',
    'private/consultations/90000000-0000-0000-000d-000000000001/verified/clinical_test_result_1.pdf',
    CURRENT_TIMESTAMP - INTERVAL '5 days', false,
    CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (id, appointment_id, patient_profile_id, doctor_id, status, subject, consultation_open_until, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000d-000000000002', '90000000-0000-0000-0002-000000000002', '90000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000001', 'OPEN', 'Giải đáp kết quả nội soi dạ dày và chế độ kiêng cữ sau điều trị Hp', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id,
    assignment_permission, assignment_metadata, joined_at, retention_expires_at
  )
  VALUES
    ('90000000-0000-0000-000e-000000000003', '90000000-0000-0000-000d-000000000002', '90000000-0000-0000-0000-000000000102', 'PATIENT', NULL, 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days'),
    ('90000000-0000-0000-000e-000000000004', '90000000-0000-0000-000d-000000000002', '90000000-0000-0000-0000-000000000023', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (id, thread_id, sequence_number, author_user_id, author_participant_id, author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000f-000000000003', '90000000-0000-0000-000d-000000000002', 1, '90000000-0000-0000-0000-000000000102', '90000000-0000-0000-000e-000000000003', 'PATIENT', 'TEXT', 'Bác sĩ cho tôi hỏi kết quả niêm mạc dạ dày phù nề thì nên ăn uống như thế nào để mau lành?', 'msg:90000000-0000-0000-000d-000000000002:1', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('90000000-0000-0000-000f-000000000004', '90000000-0000-0000-000d-000000000002', 2, '90000000-0000-0000-0000-000000000023', '90000000-0000-0000-000e-000000000004', 'DOCTOR', 'TEXT', 'Chào bạn, niêm mạc dạ dày đang phục hồi, bạn cần tránh thức ăn chua cay, kiêng rượu bia và chia nhỏ bữa ăn nhé.', 'msg:90000000-0000-0000-000d-000000000002:2', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  VALUES ('90000000-0000-0000-0020-000000000002', '90000000-0000-0000-000d-000000000002', '90000000-0000-0000-0000-000000000102', '90000000-0000-0000-000f-000000000004', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  VALUES ('90000000-0000-0000-0021-000000000002', '90000000-0000-0000-000d-000000000002', 'MESSAGE_SENT', '90000000-0000-0000-0000-000000000102', 'PATIENT', gen_random_uuid(), '{"message_id": "90000000-0000-0000-000f-000000000003"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_attachments (
    id, thread_id, message_id, private_object_key, actual_mime_type, declared_mime_type,
    size_bytes, sha256_hash, scan_status, scan_attempts, upload_status, upload_object_key,
    verified_object_key, scan_available_at, synthetic_fixture, retention_expires_at, created_at
  ) VALUES (
    '90000000-0000-0000-0022-000000000002', '90000000-0000-0000-000d-000000000002', '90000000-0000-0000-000f-000000000003',
    'private/consultations/90000000-0000-0000-000d-000000000002/verified/clinical_test_result_2.pdf',
    'application/pdf', 'application/pdf',
    204800, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'CLEAN', 1, 'UPLOADED',
    'consultations/upload/clinical_test_result_2.pdf',
    'private/consultations/90000000-0000-0000-000d-000000000002/verified/clinical_test_result_2.pdf',
    CURRENT_TIMESTAMP - INTERVAL '5 days', false,
    CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (id, appointment_id, patient_profile_id, doctor_id, status, subject, consultation_open_until, retention_expires_at, created_at)
  VALUES ('90000000-0000-0000-000d-000000000003', '90000000-0000-0000-0002-000000000003', '90000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'OPEN', 'Hướng dẫn tập vật lý trị liệu khớp gối tại nhà sau khi thăm khám', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id,
    assignment_permission, assignment_metadata, joined_at, retention_expires_at
  )
  VALUES
    ('90000000-0000-0000-000e-000000000005', '90000000-0000-0000-000d-000000000003', '90000000-0000-0000-0000-000000000103', 'PATIENT', NULL, 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days'),
    ('90000000-0000-0000-000e-000000000006', '90000000-0000-0000-000d-000000000003', '90000000-0000-0000-0000-000000000023', 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (id, thread_id, sequence_number, author_user_id, author_participant_id, author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, created_at)
  VALUES
    ('90000000-0000-0000-000f-000000000005', '90000000-0000-0000-000d-000000000003', 1, '90000000-0000-0000-0000-000000000103', '90000000-0000-0000-000e-000000000005', 'PATIENT', 'TEXT', 'Thưa bác sĩ, tôi có thể đi bộ cầu thang hay tập đạp xe tại chỗ được không ạ?', 'msg:90000000-0000-0000-000d-000000000003:1', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('90000000-0000-0000-000f-000000000006', '90000000-0000-0000-000d-000000000003', 2, '90000000-0000-0000-0000-000000000023', '90000000-0000-0000-000e-000000000006', 'DOCTOR', 'TEXT', 'Chào bác, bác nên hạn chế leo cầu thang nhiều tầng, có thể đạp xe nhẹ nhàng không kháng lực 20 phút mỗi ngày.', 'msg:90000000-0000-0000-000d-000000000003:2', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  VALUES ('90000000-0000-0000-0020-000000000003', '90000000-0000-0000-000d-000000000003', '90000000-0000-0000-0000-000000000103', '90000000-0000-0000-000f-000000000006', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  VALUES ('90000000-0000-0000-0021-000000000003', '90000000-0000-0000-000d-000000000003', 'MESSAGE_SENT', '90000000-0000-0000-0000-000000000103', 'PATIENT', gen_random_uuid(), '{"message_id": "90000000-0000-0000-000f-000000000005"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_attachments (
    id, thread_id, message_id, private_object_key, actual_mime_type, declared_mime_type,
    size_bytes, sha256_hash, scan_status, scan_attempts, upload_status, upload_object_key,
    verified_object_key, scan_available_at, synthetic_fixture, retention_expires_at, created_at
  ) VALUES (
    '90000000-0000-0000-0022-000000000003', '90000000-0000-0000-000d-000000000003', '90000000-0000-0000-000f-000000000005',
    'private/consultations/90000000-0000-0000-000d-000000000003/verified/clinical_test_result_3.pdf',
    'application/pdf', 'application/pdf',
    204800, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'CLEAN', 1, 'UPLOADED',
    'consultations/upload/clinical_test_result_3.pdf',
    'private/consultations/90000000-0000-0000-000d-000000000003/verified/clinical_test_result_3.pdf',
    CURRENT_TIMESTAMP - INTERVAL '5 days', false,
    CURRENT_TIMESTAMP + INTERVAL '80 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

-- 10. HEALTH QUESTIONS, ANSWERS, REPORTS
  ALTER FUNCTION health_question_answer_guard() SET search_path = public, extensions, pg_catalog;

  INSERT INTO health_questions (id, patient_profile_id, author_user_id, topic_slug, normalized_question, public_alias, pii_scan_status, pii_scanned_at, status, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0010-000000000001', '90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000101', 'hay-bi-chong-mat-khi-dung-day-co-phai-thieu-mau-nao', 'Tôi hay bị hoa mắt chóng mặt mỗi khi đứng dậy nhanh, đo huyết áp bình thường thì có phải do thiếu máu não không?', 'NguoiBenh_100', 'CLEAR', CURRENT_TIMESTAMP - INTERVAL '8 days', 'PUBLISHED', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (id, question_id, revision, doctor_user_id, answer_text, answer_hash, status, reviewer_user_id, reviewed_at, review_reason_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0011-000000000001', '90000000-0000-0000-0010-000000000001', 1, '90000000-0000-0000-0000-000000000023', 'Triệu chứng của bạn rất điển hình cho hạ huyết áp tư thế đứng hoặc rối loạn tiền đình nhẹ. Bạn nên thay đổi tư thế từ từ, uống đủ nước và đi kiểm tra chuyên khoa Nội Thần kinh để siêu âm mạch máu não nhé.', '8390deca2733f6c10b212c016fae659bf9fac9175f5a313fa194866e36ce0522', 'APPROVED', '90000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP - INTERVAL '7 days', 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_reports (id, question_id, reporter_user_id, reason_code, status, handled_by_admin_user_id, handled_at, resolution_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0012-000000000001', '90000000-0000-0000-0010-000000000001', '90000000-0000-0000-0000-000000000101', 'DUPLICATE', 'RESOLVED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '6 days', 'DUPLICATE', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (id, patient_profile_id, author_user_id, topic_slug, normalized_question, public_alias, pii_scan_status, pii_scanned_at, status, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0010-000000000002', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000102', 'tre-em-3-tuoi-sot-ve-dem-khi-nao-can-di-vien-cap-cuu', 'Bé nhà tôi 3 tuổi bị sốt nhẹ ban ngày nhưng đêm sốt cao 39 độ, khi nào thì cần đưa bé đi bệnh viện cấp cứu gấp?', 'NguoiBenh_101', 'CLEAR', CURRENT_TIMESTAMP - INTERVAL '8 days', 'PUBLISHED', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (id, question_id, revision, doctor_user_id, answer_text, answer_hash, status, reviewer_user_id, reviewed_at, review_reason_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0011-000000000002', '90000000-0000-0000-0010-000000000002', 1, '90000000-0000-0000-0000-000000000023', 'Nếu bé sốt trên 38.5 độ kèm co giật, thở nhanh rút lõm lồng ngực, li bì khó đánh thức hoặc nôn trớ liên tục, gia đình cần đưa bé đến ngay cơ sở y tế gần nhất hoặc gọi cấp cứu 115 để xử trí kịp thời.', 'e1e53ad9361601c8e29f7e9f9e1963cfa58880e864141a6aa1d08c5311d36b2a', 'APPROVED', '90000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP - INTERVAL '7 days', 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_reports (id, question_id, reporter_user_id, reason_code, status, handled_by_admin_user_id, handled_at, resolution_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0012-000000000002', '90000000-0000-0000-0010-000000000002', '90000000-0000-0000-0000-000000000102', 'DUPLICATE', 'RESOLVED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '6 days', 'DUPLICATE', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (id, patient_profile_id, author_user_id, topic_slug, normalized_question, public_alias, pii_scan_status, pii_scanned_at, status, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0010-000000000003', '90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0000-000000000103', 'dau-am-i-vung-thuong-vi-sau-khi-an-chua-the-nao', 'Tôi thường xuyên đau âm ỉ vùng trên rốn sau bữa ăn khoảng 1-2 tiếng, có cảm giác đầy chướng khó tiêu thì là bệnh gì?', 'NguoiBenh_102', 'CLEAR', CURRENT_TIMESTAMP - INTERVAL '8 days', 'PUBLISHED', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (id, question_id, revision, doctor_user_id, answer_text, answer_hash, status, reviewer_user_id, reviewed_at, review_reason_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0011-000000000003', '90000000-0000-0000-0010-000000000003', 1, '90000000-0000-0000-0000-000000000023', 'Đây là biểu hiện thường gặp của viêm loét dạ dày - tá tràng. Bạn nên đi khám chuyên khoa Tiêu hóa để nội soi dạ dày xác định chính xác tổn thương và tình trạng nhiễm vi khuẩn Hp.', '243a826c76f7135f2c3938eb37bd6adb052298590261b62ea267039d2e9b0f45', 'APPROVED', '90000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP - INTERVAL '7 days', 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_reports (id, question_id, reporter_user_id, reason_code, status, handled_by_admin_user_id, handled_at, resolution_code, created_at, retention_expires_at)
  VALUES ('90000000-0000-0000-0012-000000000003', '90000000-0000-0000-0010-000000000003', '90000000-0000-0000-0000-000000000103', 'DUPLICATE', 'RESOLVED', '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '6 days', 'DUPLICATE', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP + INTERVAL '80 days')
  ON CONFLICT (id) DO NOTHING;

-- 11. JOB POSITIONS & JOB APPLICATIONS

  INSERT INTO job_positions (id, slug, title, department, location, employment_type, summary, responsibilities, requirements, benefits, deadline, featured, active, created_at)
  VALUES ('90000000-0000-0000-0013-000000000001', 'bac-si-chuyen-khoa-tim-mach-can-thiep', 'Bác sĩ Chuyên khoa Tim mạch Can thiệp', 'Khối Lâm sàng - Tim mạch', 'Bệnh viện HealthCare Cơ sở 1 - Hà Nội', 'FULL_TIME', 'Phụ trách can thiệp tim mạch, chụp động mạch vành và điều trị chuyên sâu bệnh lý mạch vành.', 'Thực hiện thủ thuật can thiệp tim mạch theo quy trình chuẩn. Khám và điều trị bệnh nhân nội trú tim mạch.', 'Tốt nghiệp Bác sĩ Chuyên khoa 1 hoặc Thạc sĩ Tim mạch trở lên. Có chứng chỉ hành nghề can thiệp tim mạch.', 'Thu nhập cạnh tranh 40 - 70 triệu/tháng. Được đào tạo tu nghiệp tại Nhật Bản và Châu Âu.', CURRENT_DATE + INTERVAL '45 days', true, true, CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO job_applications (id, application_code, job_position_id, full_name, email, phone, years_experience, cover_letter, resume_url, privacy_consent_at, status, created_at)
  VALUES ('90000000-0000-0000-0014-000000000001', 'HC-HR-20260901-100', '90000000-0000-0000-0013-000000000001', 'Ứng viên Bác sĩ Chuyên khoa 1', 'candidate_1@healthcare.id.vn', '0934567890', 5, 'Kính gửi Hội đồng Tuyển dụng HealthCare, tôi có nguyện vọng ứng tuyển và cống hiến chuyên môn cho bệnh viện.', 'https://www.healthcare.id.vn/resumes/cv_candidate_1.pdf', CURRENT_TIMESTAMP - INTERVAL '5 days', 'UNDER_REVIEW', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (application_code) DO NOTHING;

  INSERT INTO job_positions (id, slug, title, department, location, employment_type, summary, responsibilities, requirements, benefits, deadline, featured, active, created_at)
  VALUES ('90000000-0000-0000-0013-000000000002', 'bac-si-chuyen-khoa-nhi-lam-sang', 'Bác sĩ Chuyên khoa Nhi Lâm sàng', 'Khối Lâm sàng - Khoa Nhi', 'Bệnh viện HealthCare Cơ sở 2 - TP.HCM', 'FULL_TIME', 'Khám, chẩn đoán và điều trị bệnh lý nhi khoa tổng quát, tiêm chủng và theo dõi phát triển trẻ nhỏ.', 'Khám và tư vấn dinh dưỡng cho trẻ. Xử trí các ca cấp cứu hô hấp, tiêu hóa nhi khoa.', 'Bác sĩ CKI hoặc Bác sĩ Đa khoa có định hướng Nhi từ 3 năm kinh nghiệm. Yêu trẻ và tận tâm.', 'Lương thưởng hấp dẫn 30 - 50 triệu/tháng. Chế độ chăm sóc y tế toàn diện cho gia đình.', CURRENT_DATE + INTERVAL '45 days', true, true, CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO job_applications (id, application_code, job_position_id, full_name, email, phone, years_experience, cover_letter, resume_url, privacy_consent_at, status, created_at)
  VALUES ('90000000-0000-0000-0014-000000000002', 'HC-HR-20260902-101', '90000000-0000-0000-0013-000000000002', 'Ứng viên Bác sĩ Chuyên khoa 2', 'candidate_2@healthcare.id.vn', '0934567891', 5, 'Kính gửi Hội đồng Tuyển dụng HealthCare, tôi có nguyện vọng ứng tuyển và cống hiến chuyên môn cho bệnh viện.', 'https://www.healthcare.id.vn/resumes/cv_candidate_2.pdf', CURRENT_TIMESTAMP - INTERVAL '5 days', 'UNDER_REVIEW', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (application_code) DO NOTHING;

  INSERT INTO job_positions (id, slug, title, department, location, employment_type, summary, responsibilities, requirements, benefits, deadline, featured, active, created_at)
  VALUES ('90000000-0000-0000-0013-000000000003', 'dieu-duong-truong-khoa-cap-cuu-hoi-suc', 'Điều dưỡng trưởng Khoa Cấp cứu Hồi sức', 'Khối Điều dưỡng - Cấp cứu', 'Bệnh viện HealthCare Cơ sở 1 - Hà Nội', 'FULL_TIME', 'Điều phối hoạt động điều dưỡng tại khoa Cấp cứu, quản lý phân ca và đảm bảo an toàn người bệnh.', 'Giám sát quy trình chăm sóc người bệnh cấp cứu. Đào tạo và đánh giá năng lực điều dưỡng viên.', 'Cử nhân Điều dưỡng trở lên, tối thiểu 5 năm kinh nghiệm cấp cứu hồi sức, 2 năm quản lý.', 'Thu nhập 25 - 35 triệu/tháng. Phụ cấp độc hại và ca trực cao cấp.', CURRENT_DATE + INTERVAL '45 days', true, true, CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO job_applications (id, application_code, job_position_id, full_name, email, phone, years_experience, cover_letter, resume_url, privacy_consent_at, status, created_at)
  VALUES ('90000000-0000-0000-0014-000000000003', 'HC-HR-20260903-102', '90000000-0000-0000-0013-000000000003', 'Ứng viên Bác sĩ Chuyên khoa 3', 'candidate_3@healthcare.id.vn', '0934567892', 5, 'Kính gửi Hội đồng Tuyển dụng HealthCare, tôi có nguyện vọng ứng tuyển và cống hiến chuyên môn cho bệnh viện.', 'https://www.healthcare.id.vn/resumes/cv_candidate_3.pdf', CURRENT_TIMESTAMP - INTERVAL '5 days', 'UNDER_REVIEW', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (application_code) DO NOTHING;

  INSERT INTO job_positions (id, slug, title, department, location, employment_type, summary, responsibilities, requirements, benefits, deadline, featured, active, created_at)
  VALUES ('90000000-0000-0000-0013-000000000004', 'ky-thuat-vien-chan-doan-hinh-anh-mri-ct', 'Kỹ thuật viên Chẩn đoán Hình ảnh (MRI / CT 128 lát)', 'Khối Cận lâm sàng', 'Bệnh viện HealthCare Cơ sở 3 - Đà Nẵng', 'FULL_TIME', 'Vận hành hệ thống máy chụp cộng hưởng từ MRI 3.0 Tesla và CT đa dãy phục vụ chẩn đoán.', 'Tiếp nhận bệnh nhân, chuẩn bị tư thế và thực hiện chụp chiếu theo chỉ định bác sĩ. Bảo quản máy móc.', 'Cử nhân Kỹ thuật hình ảnh y học. Có kinh nghiệm vận hành MRI hoặc CT từ 2 năm trở lên.', 'Mức lương thỏa thuận 18 - 28 triệu/tháng. Môi trường làm việc trang thiết bị hiện đại chuẩn quốc tế.', CURRENT_DATE + INTERVAL '45 days', true, true, CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO job_applications (id, application_code, job_position_id, full_name, email, phone, years_experience, cover_letter, resume_url, privacy_consent_at, status, created_at)
  VALUES ('90000000-0000-0000-0014-000000000004', 'HC-HR-20260904-103', '90000000-0000-0000-0013-000000000004', 'Ứng viên Bác sĩ Chuyên khoa 4', 'candidate_4@healthcare.id.vn', '0934567893', 5, 'Kính gửi Hội đồng Tuyển dụng HealthCare, tôi có nguyện vọng ứng tuyển và cống hiến chuyên môn cho bệnh viện.', 'https://www.healthcare.id.vn/resumes/cv_candidate_4.pdf', CURRENT_TIMESTAMP - INTERVAL '5 days', 'UNDER_REVIEW', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (application_code) DO NOTHING;

-- 12. BANK TRANSFER PAYMENTS, WEBHOOK EVENTS, AUDIT LOGS

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000001', '90000000-0000-0000-0002-000000000001', 150000, 'VND', 'HEALTHCARE_BK_20260901_100', 'PAID', 'VCB_FT20260901000', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260901_1', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000001', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000001', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000001', '90000000-0000-0000-0002-000000000001', 'Giao dịch chuyển khoản 150000 VND khớp chính xác nội dung HEALTHCARE_BK_20260901_100', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000002', '90000000-0000-0000-0002-000000000002', 250000, 'VND', 'HEALTHCARE_BK_20260902_101', 'PAID', 'VCB_FT20260901001', CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260902_2', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000002', CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000002', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000002', '90000000-0000-0000-0002-000000000002', 'Giao dịch chuyển khoản 250000 VND khớp chính xác nội dung HEALTHCARE_BK_20260902_101', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000003', '90000000-0000-0000-0002-000000000003', 150000, 'VND', 'HEALTHCARE_BK_20260903_102', 'PAID', 'VCB_FT20260901002', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260903_3', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000003', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000003', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000003', '90000000-0000-0000-0002-000000000003', 'Giao dịch chuyển khoản 150000 VND khớp chính xác nội dung HEALTHCARE_BK_20260903_102', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000004', '90000000-0000-0000-0002-000000000004', 250000, 'VND', 'HEALTHCARE_BK_20260904_103', 'PAID', 'VCB_FT20260901003', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260904_4', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000004', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000004', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000004', '90000000-0000-0000-0002-000000000004', 'Giao dịch chuyển khoản 250000 VND khớp chính xác nội dung HEALTHCARE_BK_20260904_103', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000005', '90000000-0000-0000-0002-000000000005', 150000, 'VND', 'HEALTHCARE_BK_20260905_104', 'PAID', 'VCB_FT20260901004', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260905_5', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000005', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000005', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000005', '90000000-0000-0000-0002-000000000005', 'Giao dịch chuyển khoản 150000 VND khớp chính xác nội dung HEALTHCARE_BK_20260905_104', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bank_transfer_payments (id, appointment_id, amount, currency, transfer_content, status, transaction_reference, submitted_at, verified_at, created_at)
  VALUES ('90000000-0000-0000-0015-000000000006', '90000000-0000-0000-0002-000000000006', 250000, 'VND', 'HEALTHCARE_BK_20260906_105', 'PAID', 'VCB_FT20260901005', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('EVT_SEPAY_20260906_6', '38b72591b61c56b6b7a8d56b4f7a229a3a936a2cd534825990e69b22a0df80b7', '90000000-0000-0000-0015-000000000006', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '1 second')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('90000000-0000-0000-0016-000000000006', 'system.sepay@healthcare.id.vn', 'CONFIRM_PAYMENT_SUCCESS', '90000000-0000-0000-0015-000000000006', '90000000-0000-0000-0002-000000000006', 'Giao dịch chuyển khoản 250000 VND khớp chính xác nội dung HEALTHCARE_BK_20260906_105', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

-- 13. STORED FILES, PATIENT DOCUMENTS, MEDIA ASSETS

  INSERT INTO stored_files (id, object_key, uploader_id, patient_id, original_filename, content_type, size_bytes, purpose, created_at)
  VALUES ('90000000-0000-0000-0017-000000000001', 'clinical-reports/summary-report-20260901.pdf', '90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000201', 'Ban_Tong_Ket_Kham_Benh_20260901.pdf', 'application/pdf', 384512, 'PATIENT_DOCUMENT', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (object_key) DO NOTHING;

  INSERT INTO patient_documents (id, patient_id, source_record_id, source_type, source_version, template_version, status, object_key, sha256, byte_size, generated_by, generated_at, idempotency_key)
  VALUES ('90000000-0000-0000-0018-000000000001', '90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0006-000000000001', 'VISIT_SUMMARY', 1, 'v1.0', 'AVAILABLE', 'documents/clinical-summary-20260901.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512, '90000000-0000-0000-0000-000000000101', CURRENT_TIMESTAMP - INTERVAL '10 days', 'VISIT_SUMMARY:90000000-0000-0000-0006-000000000001:1:v1.0')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO media_assets (id, filename, content_type, size_bytes, data, purpose, object_key, created_at)
  VALUES ('90000000-0000-0000-0019-000000000001', 'patient_ecg_trace_1.png', 'image/png', 245120, '\x89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082'::bytea, 'CLINICAL_RESULT', 'media/clinical/patient_ecg_trace_1.png', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO stored_files (id, object_key, uploader_id, patient_id, original_filename, content_type, size_bytes, purpose, created_at)
  VALUES ('90000000-0000-0000-0017-000000000002', 'clinical-reports/summary-report-20260902.pdf', '90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000202', 'Ban_Tong_Ket_Kham_Benh_20260902.pdf', 'application/pdf', 384512, 'PATIENT_DOCUMENT', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (object_key) DO NOTHING;

  INSERT INTO patient_documents (id, patient_id, source_record_id, source_type, source_version, template_version, status, object_key, sha256, byte_size, generated_by, generated_at, idempotency_key)
  VALUES ('90000000-0000-0000-0018-000000000002', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0006-000000000002', 'VISIT_SUMMARY', 1, 'v1.0', 'AVAILABLE', 'documents/clinical-summary-20260902.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512, '90000000-0000-0000-0000-000000000102', CURRENT_TIMESTAMP - INTERVAL '10 days', 'VISIT_SUMMARY:90000000-0000-0000-0006-000000000002:1:v1.0')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO media_assets (id, filename, content_type, size_bytes, data, purpose, object_key, created_at)
  VALUES ('90000000-0000-0000-0019-000000000002', 'patient_ecg_trace_2.png', 'image/png', 245120, '\x89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082'::bytea, 'CLINICAL_RESULT', 'media/clinical/patient_ecg_trace_2.png', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO stored_files (id, object_key, uploader_id, patient_id, original_filename, content_type, size_bytes, purpose, created_at)
  VALUES ('90000000-0000-0000-0017-000000000003', 'clinical-reports/summary-report-20260903.pdf', '90000000-0000-0000-0000-000000000103', '90000000-0000-0000-0000-000000000203', 'Ban_Tong_Ket_Kham_Benh_20260903.pdf', 'application/pdf', 384512, 'PATIENT_DOCUMENT', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (object_key) DO NOTHING;

  INSERT INTO patient_documents (id, patient_id, source_record_id, source_type, source_version, template_version, status, object_key, sha256, byte_size, generated_by, generated_at, idempotency_key)
  VALUES ('90000000-0000-0000-0018-000000000003', '90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0006-000000000003', 'VISIT_SUMMARY', 1, 'v1.0', 'AVAILABLE', 'documents/clinical-summary-20260903.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512, '90000000-0000-0000-0000-000000000103', CURRENT_TIMESTAMP - INTERVAL '10 days', 'VISIT_SUMMARY:90000000-0000-0000-0006-000000000003:1:v1.0')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO media_assets (id, filename, content_type, size_bytes, data, purpose, object_key, created_at)
  VALUES ('90000000-0000-0000-0019-000000000003', 'patient_ecg_trace_3.png', 'image/png', 245120, '\x89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082'::bytea, 'CLINICAL_RESULT', 'media/clinical/patient_ecg_trace_3.png', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO stored_files (id, object_key, uploader_id, patient_id, original_filename, content_type, size_bytes, purpose, created_at)
  VALUES ('90000000-0000-0000-0017-000000000004', 'clinical-reports/summary-report-20260904.pdf', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000204', 'Ban_Tong_Ket_Kham_Benh_20260904.pdf', 'application/pdf', 384512, 'PATIENT_DOCUMENT', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (object_key) DO NOTHING;

  INSERT INTO patient_documents (id, patient_id, source_record_id, source_type, source_version, template_version, status, object_key, sha256, byte_size, generated_by, generated_at, idempotency_key)
  VALUES ('90000000-0000-0000-0018-000000000004', '90000000-0000-0000-0000-000000000204', '90000000-0000-0000-0006-000000000004', 'VISIT_SUMMARY', 1, 'v1.0', 'AVAILABLE', 'documents/clinical-summary-20260904.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512, '90000000-0000-0000-0000-000000000104', CURRENT_TIMESTAMP - INTERVAL '10 days', 'VISIT_SUMMARY:90000000-0000-0000-0006-000000000004:1:v1.0')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO media_assets (id, filename, content_type, size_bytes, data, purpose, object_key, created_at)
  VALUES ('90000000-0000-0000-0019-000000000004', 'patient_ecg_trace_4.png', 'image/png', 245120, '\x89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082'::bytea, 'CLINICAL_RESULT', 'media/clinical/patient_ecg_trace_4.png', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

-- 14. EMAIL OUTBOX & NOTIFICATIONS

  INSERT INTO email_outbox (id, user_id, event_reference_id, event_type, template_key, template_version, idempotency_key, status, attempts, expires_at, sent_at, created_at)
  VALUES ('90000000-0000-0000-001a-000000000001', '90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0002-000000000001', 'APPOINTMENT_CONFIRMED', 'appointment_confirmation_vi', 1, 'email:appointment_confirmed:90000000-0000-0000-0002-000000000001', 'SENT', 1, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO notifications (id, user_id, event_type, title, message, reference_id, is_read, created_at)
  VALUES ('90000000-0000-0000-001b-000000000001', '90000000-0000-0000-0000-000000000101', 'APPOINTMENT_CONFIRMED', 'Lịch khám bệnh đã được xác nhận', 'Lịch khám của bạn tại HealthCare đã được xác nhận thành công. Vui lòng đến trước 15 phút.', '90000000-0000-0000-0002-000000000001', true, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO email_outbox (id, user_id, event_reference_id, event_type, template_key, template_version, idempotency_key, status, attempts, expires_at, sent_at, created_at)
  VALUES ('90000000-0000-0000-001a-000000000002', '90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0002-000000000002', 'APPOINTMENT_CONFIRMED', 'appointment_confirmation_vi', 1, 'email:appointment_confirmed:90000000-0000-0000-0002-000000000002', 'SENT', 1, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO notifications (id, user_id, event_type, title, message, reference_id, is_read, created_at)
  VALUES ('90000000-0000-0000-001b-000000000002', '90000000-0000-0000-0000-000000000102', 'APPOINTMENT_CONFIRMED', 'Lịch khám bệnh đã được xác nhận', 'Lịch khám của bạn tại HealthCare đã được xác nhận thành công. Vui lòng đến trước 15 phút.', '90000000-0000-0000-0002-000000000002', true, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO email_outbox (id, user_id, event_reference_id, event_type, template_key, template_version, idempotency_key, status, attempts, expires_at, sent_at, created_at)
  VALUES ('90000000-0000-0000-001a-000000000003', '90000000-0000-0000-0000-000000000103', '90000000-0000-0000-0002-000000000003', 'APPOINTMENT_CONFIRMED', 'appointment_confirmation_vi', 1, 'email:appointment_confirmed:90000000-0000-0000-0002-000000000003', 'SENT', 1, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO notifications (id, user_id, event_type, title, message, reference_id, is_read, created_at)
  VALUES ('90000000-0000-0000-001b-000000000003', '90000000-0000-0000-0000-000000000103', 'APPOINTMENT_CONFIRMED', 'Lịch khám bệnh đã được xác nhận', 'Lịch khám của bạn tại HealthCare đã được xác nhận thành công. Vui lòng đến trước 15 phút.', '90000000-0000-0000-0002-000000000003', true, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO email_outbox (id, user_id, event_reference_id, event_type, template_key, template_version, idempotency_key, status, attempts, expires_at, sent_at, created_at)
  VALUES ('90000000-0000-0000-001a-000000000004', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0002-000000000004', 'APPOINTMENT_CONFIRMED', 'appointment_confirmation_vi', 1, 'email:appointment_confirmed:90000000-0000-0000-0002-000000000004', 'SENT', 1, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO notifications (id, user_id, event_type, title, message, reference_id, is_read, created_at)
  VALUES ('90000000-0000-0000-001b-000000000004', '90000000-0000-0000-0000-000000000104', 'APPOINTMENT_CONFIRMED', 'Lịch khám bệnh đã được xác nhận', 'Lịch khám của bạn tại HealthCare đã được xác nhận thành công. Vui lòng đến trước 15 phút.', '90000000-0000-0000-0002-000000000004', true, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO email_outbox (id, user_id, event_reference_id, event_type, template_key, template_version, idempotency_key, status, attempts, expires_at, sent_at, created_at)
  VALUES ('90000000-0000-0000-001a-000000000005', '90000000-0000-0000-0000-000000000105', '90000000-0000-0000-0002-000000000005', 'APPOINTMENT_CONFIRMED', 'appointment_confirmation_vi', 1, 'email:appointment_confirmed:90000000-0000-0000-0002-000000000005', 'SENT', 1, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO notifications (id, user_id, event_type, title, message, reference_id, is_read, created_at)
  VALUES ('90000000-0000-0000-001b-000000000005', '90000000-0000-0000-0000-000000000105', 'APPOINTMENT_CONFIRMED', 'Lịch khám bệnh đã được xác nhận', 'Lịch khám của bạn tại HealthCare đã được xác nhận thành công. Vui lòng đến trước 15 phút.', '90000000-0000-0000-0002-000000000005', true, CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

-- 15. CMS CONTENT CHANGES & AI CONTENT REVIEW EVENTS

  INSERT INTO cms_content_changes (content_id, slot_key, content_version, published, actor_email, component_type, status, payload, public_event, changed_at)
  VALUES ('80000000-0000-0000-0000-000000000001', 'homepage.hero', 1, true, 'admin@healthcare.id.vn', 'HERO', 'PUBLISHED', '{"body":"Đặt lịch khám và tìm hiểu dịch vụ chăm sóc phù hợp với nhu cầu của bạn.","title":"Đồng hành cùng sức khỏe gia đình","ctaHref":"/dat-lich","eyebrow":"Chăm sóc chủ động","ctaLabel":"Đặt lịch khám"}'::jsonb, true, CURRENT_TIMESTAMP - INTERVAL '10 days');

  INSERT INTO cms_content_changes (content_id, slot_key, content_version, published, actor_email, component_type, status, payload, public_event, changed_at)
  VALUES ('80000000-0000-0000-0000-000000000002', 'careers.hero', 1, true, 'admin@healthcare.id.vn', 'HERO', 'PUBLISHED', '{"body":"Khám phá môi trường làm việc đề cao an toàn, phối hợp liên chuyên môn và sự phát triển bền vững của mỗi thành viên.","title":"Cùng chăm sóc người bệnh bằng năng lực và sự tử tế","ctaHref":"/careers#vi-tri-dang-tuyen","eyebrow":"Cơ hội nghề nghiệp tại HealthCare","ctaLabel":"Xem vị trí đang tuyển"}'::jsonb, true, CURRENT_TIMESTAMP - INTERVAL '10 days');

  INSERT INTO cms_content_changes (content_id, slot_key, content_version, published, actor_email, component_type, status, payload, public_event, changed_at)
  VALUES ('80000000-0000-0000-0000-000000000003', 'careers.body', 1, true, 'admin@healthcare.id.vn', 'RICH_TEXT', 'PUBLISHED', '{"body":"Chúng tôi trân trọng tinh thần học hỏi, giao tiếp rõ ràng và cam kết đặt an toàn của người bệnh lên hàng đầu trong mọi vai trò.","title":"Điều chúng tôi mong đợi ở đồng đội"}'::jsonb, true, CURRENT_TIMESTAMP - INTERVAL '10 days');

  INSERT INTO cms_content_changes (content_id, slot_key, content_version, published, actor_email, component_type, status, payload, public_event, changed_at)
  VALUES ('80000000-0000-0000-0000-000000000004', 'search.hero', 1, true, 'admin@healthcare.id.vn', 'HERO', 'PUBLISHED', '{"body":"Kết quả được lọc trực tiếp từ chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang của backend.","title":"Tìm kiếm theo dữ liệu đã xuất bản","eyebrow":"Catalog active"}'::jsonb, true, CURRENT_TIMESTAMP - INTERVAL '10 days');

  INSERT INTO cms_content_changes (content_id, slot_key, content_version, published, actor_email, component_type, status, payload, public_event, changed_at)
  VALUES ('80000000-0000-0000-0000-000000000005', 'homepage.body', 1, true, 'admin@healthcare.id.vn', 'RICH_TEXT', 'PUBLISHED', '{"body":"Thông tin mới từ quản trị viên sẽ xuất hiện tại đây theo version đã xuất bản. Dữ liệu chuyên khoa, bác sĩ và cơ sở vẫn được đọc trực tiếp từ catalog backend.","title":"Hành trình chăm sóc được cập nhật"}'::jsonb, true, CURRENT_TIMESTAMP - INTERVAL '10 days');

  INSERT INTO ai_content_review_events (event_id, source_type, source_id, content_revision, content_hash, eligibility_revision, approval_round, event_type, actor_role, actor_id, correlation_id, reason, metadata, occurred_at)
  SELECT 
    ('90000000-0000-0000-001c-0000000000' || lpad(to_hex(row_number() over ()), 2, '0'))::uuid,
    source_type, source_id, content_revision, content_hash, 1, approval_round, 'APPROVED', 'DOCTOR', reviewed_by, gen_random_uuid(), 'Bác sĩ chuyên khoa thẩm định và phê duyệt nội dung lâm sàng', '{"automated": false, "score": 100, "verified_by": "Specialist"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM ai_content_approval_rounds
  LIMIT 15
  ON CONFLICT (event_id) DO NOTHING;

-- 16. OBJECT CLEANUP QUEUES, SYNC OUTBOX EVENTS & REFRESH TOKENS
  INSERT INTO patient_consultation_object_cleanup (id, thread_id, attachment_id, object_key, status, attempts, next_attempt_at, created_at, completed_at)
  VALUES
    ('90000000-0000-0000-0023-000000000001', '90000000-0000-0000-000d-000000000001', '90000000-0000-0000-0022-000000000001', 'private/consultations/archived/old_scan_01.pdf', 'DONE', 1, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('90000000-0000-0000-0023-000000000002', '90000000-0000-0000-000d-000000000002', '90000000-0000-0000-0022-000000000002', 'private/consultations/archived/old_scan_02.pdf', 'DONE', 1, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_document_object_cleanup (id, object_key, status, attempts, next_attempt_at, created_at, completed_at)
  VALUES
    ('90000000-0000-0000-0024-000000000001', 'documents/archived/old_summary_01.pdf', 'DONE', 1, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('90000000-0000-0000-0024-000000000002', 'documents/archived/old_summary_02.pdf', 'DONE', 1, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO sync_outbox_events (event_id, entity_classification, entity_type, entity_id, operation, revision, content_hash, idempotency_key, occurred_at, correlation_id, status, attempt_count, available_at, acknowledged_at, created_at, updated_at)
  VALUES
    ('90000000-0000-0000-0025-000000000001', 'PUBLIC_CATALOG', 'articles', '10000000-0000-0000-0000-000000000001', 'UPSERT', 1, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'public_catalog:articles:10000000-0000-0000-0000-000000000001:1:UPSERT', CURRENT_TIMESTAMP - INTERVAL '5 days', gen_random_uuid(), 'PROCESSED', 1, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('90000000-0000-0000-0025-000000000002', 'PUBLIC_CATALOG', 'doctors', '10000000-0000-0000-0000-000000000002', 'UPSERT', 1, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'public_catalog:doctors:10000000-0000-0000-0000-000000000002:1:UPSERT', CURRENT_TIMESTAMP - INTERVAL '5 days', gen_random_uuid(), 'PROCESSED', 1, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
  VALUES
    ('90000000-0000-0000-0026-000000000001', '90000000-0000-0000-0000-000000000001', '7a51c964177b94b0f92b774f2bb734d708f51a66a1d8a876793cf824ef78c25f', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('90000000-0000-0000-0026-000000000002', '90000000-0000-0000-0000-000000000002', '8b62da75288c05c10a3c885e3cc845e819f62b77b2e9b987804df935fg89d36a', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (token_hash) DO NOTHING;

END $$;
