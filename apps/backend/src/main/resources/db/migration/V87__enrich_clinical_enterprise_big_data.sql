-- V87__enrich_clinical_enterprise_big_data.sql
-- Enterprise-grade Big Data Clinical Seed for HealthCare Ecosystem.
-- Adds 150+ realistic appointments, claims, medical records, diagnostic orders, prescriptions, care plans, and consultations.

DO $$
BEGIN


-- 1. Expand Patient Profiles & Users

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000001', 'patient_enterprise_1@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Hoàng Văn Thái', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000001', '80000000-0000-0000-0001-000000000001', 'Hoàng Văn Thái', '0901122334', '1975-04-12'::date, 'MALE', 'Quận Cầu Giấy, Hà Nội', 'O+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000002', 'patient_enterprise_2@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Trần Thị Thu Thảo', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000002', '80000000-0000-0000-0001-000000000002', 'Trần Thị Thu Thảo', '0902233445', '1988-09-25'::date, 'FEMALE', 'Quận 3, TP. Hồ Chí Minh', 'A+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000003', 'patient_enterprise_3@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Nguyễn Quốc Tuấn', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000003', '80000000-0000-0000-0001-000000000003', 'Nguyễn Quốc Tuấn', '0903344556', '1962-11-03'::date, 'MALE', 'Quận Hải Châu, Đà Nẵng', 'B+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000004', 'patient_enterprise_4@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Phạm Thị Mỹ Linh', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000004', '80000000-0000-0000-0001-000000000004', 'Phạm Thị Mỹ Linh', '0904455667', '1995-02-18'::date, 'FEMALE', 'Quận Ninh Kiều, Cần Thơ', 'AB+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000005', 'patient_enterprise_5@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Đặng Thanh Tùng', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000005', '80000000-0000-0000-0001-000000000005', 'Đặng Thanh Tùng', '0905566778', '1980-07-30'::date, 'MALE', 'Quận Hồng Bàng, Hải Phòng', 'O-', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000006', 'patient_enterprise_6@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Lê Cẩm Tú', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000006', '80000000-0000-0000-0001-000000000006', 'Lê Cẩm Tú', '0906677889', '1992-06-14'::date, 'FEMALE', 'TP. Hạ Long, Quảng Ninh', 'A-', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000007', 'patient_enterprise_7@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Vũ Đức Thịnh', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000007', '80000000-0000-0000-0001-000000000007', 'Vũ Đức Thịnh', '0907788990', '1958-03-22'::date, 'MALE', 'TP. Thủ Dầu Một, Bình Dương', 'O+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000008', 'patient_enterprise_8@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Bùi Ánh Tuyết', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000008', '80000000-0000-0000-0001-000000000008', 'Bùi Ánh Tuyết', '0908899001', '1984-12-08'::date, 'FEMALE', 'TP. Biên Hòa, Đồng Nai', 'B+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-000000000009', 'patient_enterprise_9@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Đỗ Hữu Phước', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-000000000009', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-000000000009', '80000000-0000-0000-0001-000000000009', 'Đỗ Hữu Phước', '0909900112', '1972-08-19'::date, 'MALE', 'TP. Nha Trang, Khánh Hòa', 'A+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000a', 'patient_enterprise_10@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Phan Thị Ngọc Hà', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000a', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000a', '80000000-0000-0000-0001-00000000000a', 'Phan Thị Ngọc Hà', '0910011223', '1990-10-05'::date, 'FEMALE', 'TP. Huế, Thừa Thiên Huế', 'AB-', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000b', 'patient_enterprise_11@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Ngô Quang Khải', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000b', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000b', '80000000-0000-0000-0001-00000000000b', 'Ngô Quang Khải', '0911122334', '1966-05-17'::date, 'MALE', 'Quận Ba Đình, Hà Nội', 'O+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000c', 'patient_enterprise_12@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Dương Thị Phương', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000c', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000c', '80000000-0000-0000-0001-00000000000c', 'Dương Thị Phương', '0912233445', '1986-01-29'::date, 'FEMALE', 'Quận 7, TP. Hồ Chí Minh', 'A+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000d', 'patient_enterprise_13@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Lâm Văn Hùng', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000d', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000d', '80000000-0000-0000-0001-00000000000d', 'Lâm Văn Hùng', '0913344556', '1979-09-11'::date, 'MALE', 'Quận Thanh Khê, Đà Nẵng', 'B+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000e', 'patient_enterprise_14@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Võ Thùy Trang', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000e', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000e', '80000000-0000-0000-0001-00000000000e', 'Võ Thùy Trang', '0914455667', '1998-04-03'::date, 'FEMALE', 'Quận Cái Răng, Cần Thơ', 'O+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  VALUES ('80000000-0000-0000-0001-00000000000f', 'patient_enterprise_15@healthcare.id.vn', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye', 'Mai Tiến Dũng', 'ACTIVE', true, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  VALUES ('80000000-0000-0000-0001-00000000000f', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO patient_profiles (id, user_id, full_name, phone, date_of_birth, gender, address, blood_type, updated_at)
  VALUES ('80000000-0000-0000-0002-00000000000f', '80000000-0000-0000-0001-00000000000f', 'Mai Tiến Dũng', '0915566778', '1969-12-24'::date, 'MALE', 'Quận Ngô Quyền, Hải Phòng', 'A+', CURRENT_TIMESTAMP - INTERVAL '120 days')
  ON CONFLICT (id) DO NOTHING;


-- 2. Big Data Appointments (150 rows)

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000001', 'BK-2609010-EP001', '90000000-0000-0000-0000-000000000004', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '-2 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-2 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-3 days', '938260f7-85fb-43d2-b9f6-b14c46a39e16'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000002', 'BK-2609011-EP002', '90000000-0000-0000-0000-000000000013', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '-2 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-2 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000003', 'BK-2609012-EP003', '90000000-0000-0000-0000-000000000014', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf',
    (CURRENT_DATE + INTERVAL '-3 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-3 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiêu hóa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000004', 'BK-2609013-EP004', '90000000-0000-0000-0000-000000000201', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '-3 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-3 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-4 days', '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000005', 'BK-2609014-EP005', '90000000-0000-0000-0000-000000000202', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '83d56555-dc7c-f749-7271-04e0d1843da1', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '-4 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-4 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000006', 'BK-2609015-EP006', '90000000-0000-0000-0000-000000000203', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6',
    (CURRENT_DATE + INTERVAL '-4 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-4 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nhi khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000007', 'BK-2609016-EP007', '90000000-0000-0000-0000-000000000204', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '535f4437-1f68-4926-14c8-2e9d29a4f684', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '-5 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-5 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-6 days', '097bdfc5-d514-1245-b3fe-72e04d871339'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000008', 'BK-2609017-EP008', '90000000-0000-0000-0000-000000000205', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '-5 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-5 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000009', 'BK-2609018-EP009', '90000000-0000-0000-0000-000000000022', '0467b23c-312e-25b9-af98-761fd1fffa9f', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '-6 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-6 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000000a', 'BK-2609019-EP010', '90000000-0000-0000-0000-000000000206', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '-6 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-6 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-7 days', 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000000b', 'BK-2609020-EP011', '90000000-0000-0000-0000-000000000207', '05152036-18cd-98a6-92a3-cfc64f6651dd', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-7 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-7 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000000c', 'BK-2609021-EP012', '90000000-0000-0000-0000-000000000208', '05152036-18cd-98a6-92a3-cfc64f6651dd', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-7 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-7 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000000d', 'BK-2609022-EP013', '90000000-0000-0000-0000-000000000209', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '-8 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-8 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-9 days', '16931bc9-6b86-3cc4-de8e-53670e99ce41'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000000e', 'BK-2609023-EP014', '90000000-0000-0000-0000-00000000020a', '05866f27-98b4-7fd9-4e46-2f281ede4098', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '-8 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-8 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000000f', 'BK-2609024-EP015', '90000000-0000-0000-0000-00000000020b', '05866f27-98b4-7fd9-4e46-2f281ede4098', '535f4437-1f68-4926-14c8-2e9d29a4f684', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '-9 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-9 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000010', 'BK-2609025-EP016', '90000000-0000-0000-0000-00000000020c', '0603349d-dfde-11a2-1033-50c3aa512b02', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '-9 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-9 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-10 days', '81ffe666-2065-f436-5a81-eb44eb6333fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000011', 'BK-2609026-EP017', '80000000-0000-0000-0002-000000000001', '0603349d-dfde-11a2-1033-50c3aa512b02', 'c2fee201-d898-4f79-cf65-113f9af836c9', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '-10 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-10 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000012', 'BK-2609027-EP018', '80000000-0000-0000-0002-000000000002', '06487368-ce38-e21c-36f9-3b0fa28de677', '890d18bd-1881-12e9-ff66-a5bd8a8dc5d0', '993e92ff-b71f-ae7c-090f-52572e5e3f11',
    (CURRENT_DATE + INTERVAL '-10 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-10 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Ung bướu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000013', 'BK-2609028-EP019', '80000000-0000-0000-0002-000000000003', '071d8e82-0c9e-6671-9dd8-196d1071f373', '566e252d-b253-e515-5969-467b3d3a2b77', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '-11 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-11 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-12 days', '77823225-a569-2ce2-b913-4c6d71adfac8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000014', 'BK-2609029-EP020', '80000000-0000-0000-0002-000000000004', '071d8e82-0c9e-6671-9dd8-196d1071f373', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '-11 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-11 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000015', 'BK-2609030-EP021', '80000000-0000-0000-0002-000000000001', '083646c4-c3fa-3013-da09-e13691801fc5', '7e0b9ff7-9df7-8e06-fd86-f4456c9a35d2', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '-12 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-12 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000016', 'BK-2609031-EP022', '80000000-0000-0000-0002-000000000002', '083646c4-c3fa-3013-da09-e13691801fc5', 'c2fee201-d898-4f79-cf65-113f9af836c9', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '-12 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-12 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-13 days', '3bacd204-83af-68a6-9781-a12472ee71bf'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000017', 'BK-2609032-EP023', '80000000-0000-0000-0002-000000000003', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '7765688c-354a-229a-6704-e4e460ccf3fa', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '-13 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-13 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000018', 'BK-2609033-EP024', '80000000-0000-0000-0002-000000000004', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '-13 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-13 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000019', 'BK-2609034-EP025', '80000000-0000-0000-0002-000000000005', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '-14 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-14 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-15 days', '44efce0e-6734-a401-7714-50c710221fe2'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000001a', 'BK-2609035-EP026', '80000000-0000-0000-0002-000000000006', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '-14 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-14 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000001b', 'BK-2609036-EP027', '80000000-0000-0000-0002-000000000007', '0a29aded-3774-021a-2b95-bb726ec11274', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '2eba03c7-5d06-d23a-e7cb-4f74926ff849',
    (CURRENT_DATE + INTERVAL '-15 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-15 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Phục hồi chức năng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000001c', 'BK-2609037-EP028', '80000000-0000-0000-0002-000000000008', '0a8552db-6c07-6e3c-3930-4ef03b19008c', '7765688c-354a-229a-6704-e4e460ccf3fa', 'd7851b0f-8adf-f780-b818-eb7670ec1e92',
    (CURRENT_DATE + INTERVAL '-15 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-15 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Huyết học', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-16 days', '179579a2-744b-571e-7887-a371a50aa4f8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000001d', 'BK-2609038-EP029', '80000000-0000-0000-0002-000000000009', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', '8c310c68-033f-55d4-19e3-d63ed466d120', '847f0834-7126-6c7d-bf07-610a46400a82',
    (CURRENT_DATE + INTERVAL '-16 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-16 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tổng hợp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000001e', 'BK-2609039-EP030', '80000000-0000-0000-0002-00000000000a', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b3379f28-d281-e976-0690-a0238f3b2038',
    (CURRENT_DATE + INTERVAL '-16 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-16 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y tế công cộng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000001f', 'BK-2609040-EP031', '80000000-0000-0000-0002-00000000000b', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'b3379f28-d281-e976-0690-a0238f3b2038',
    (CURRENT_DATE + INTERVAL '-17 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-17 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y tế công cộng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-18 days', '5d19a424-51c3-148f-b00a-14528aa09300'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000020', 'BK-2609041-EP032', '80000000-0000-0000-0002-00000000000c', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', '566e252d-b253-e515-5969-467b3d3a2b77', 'f5ca7735-d556-148a-ed43-65ca94e41ae5',
    (CURRENT_DATE + INTERVAL '-17 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-17 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Chấn thương chỉnh hình', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000021', 'BK-2609042-EP033', '80000000-0000-0000-0002-00000000000d', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c',
    (CURRENT_DATE + INTERVAL '-18 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-18 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội mạch máu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000022', 'BK-2609043-EP034', '80000000-0000-0000-0002-00000000000e', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c',
    (CURRENT_DATE + INTERVAL '-18 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-18 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội mạch máu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-19 days', 'a7fc3862-6ed1-b5f8-8803-02ddee4f6379'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000023', 'BK-2609044-EP035', '80000000-0000-0000-0002-00000000000f', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '83d56555-dc7c-f749-7271-04e0d1843da1', '9cb56149-95dd-a351-ca75-b9b2f559d83b',
    (CURRENT_DATE + INTERVAL '-19 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-19 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiết niệu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000024', 'BK-2609045-EP036', '90000000-0000-0000-0000-000000000004', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '9cb56149-95dd-a351-ca75-b9b2f559d83b',
    (CURRENT_DATE + INTERVAL '-19 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-19 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiết niệu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000025', 'BK-2609046-EP037', '90000000-0000-0000-0000-000000000013', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '7765688c-354a-229a-6704-e4e460ccf3fa', 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa',
    (CURRENT_DATE + INTERVAL '-20 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-20 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu thẩm mỹ', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-21 days', 'ed23f337-3ee2-8c5b-51a7-a5fb511cd00b'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000026', 'BK-2609047-EP038', '90000000-0000-0000-0000-000000000014', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa',
    (CURRENT_DATE + INTERVAL '-20 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-20 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu thẩm mỹ', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000027', 'BK-2609048-EP039', '90000000-0000-0000-0000-000000000201', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '131199e1-749b-4a18-0c68-9605d41cb0a6',
    (CURRENT_DATE + INTERVAL '-21 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-21 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thính học', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000028', 'BK-2609049-EP040', '90000000-0000-0000-0000-000000000202', '0e333dc3-4388-6ae4-c059-f750302b16e0', '6eb091fd-ba5b-86dc-d21d-7ba22e7c7689', '63263a8f-985d-56bd-4a91-cbc635681fb3',
    (CURRENT_DATE + INTERVAL '-21 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-21 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Ngoại khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-22 days', 'a94904c5-e237-4f3e-fa94-fb3e030df87b'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000029', 'BK-2609050-EP041', '90000000-0000-0000-0000-000000000203', '0e51eada-c05e-4d5f-25e5-73aea8120dd3', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '462aa421-a88f-7105-7022-163467a83c2e',
    (CURRENT_DATE + INTERVAL '-22 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-22 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Ngoại thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000002a', 'BK-2609051-EP042', '90000000-0000-0000-0000-000000000204', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '68c49671-774e-a89c-c9c1-b67a88de6bff',
    (CURRENT_DATE + INTERVAL '-22 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-22 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Giải phẫu bệnh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000002b', 'BK-2609052-EP043', '90000000-0000-0000-0000-000000000205', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '68c49671-774e-a89c-c9c1-b67a88de6bff',
    (CURRENT_DATE + INTERVAL '-23 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-23 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Giải phẫu bệnh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-24 days', 'eaa5b00f-0290-3672-945d-9ac715b07b3c'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000002c', 'BK-2609053-EP044', '90000000-0000-0000-0000-000000000022', '0e6cb13d-885f-c605-966a-13c0eaa951c1', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '-23 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-23 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000002d', 'BK-2609054-EP045', '90000000-0000-0000-0000-000000000206', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95', '7765688c-354a-229a-6704-e4e460ccf3fa', '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf',
    (CURRENT_DATE + INTERVAL '-24 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-24 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiêu hóa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000002e', 'BK-2609055-EP046', '90000000-0000-0000-0000-000000000207', '0f0245c2-fd64-efb4-5561-83404f179a22', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '-24 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-24 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-25 days', 'dbfb4e7f-da3d-57d3-3573-c26528482839'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000002f', 'BK-2609056-EP047', '90000000-0000-0000-0000-000000000208', '0f0245c2-fd64-efb4-5561-83404f179a22', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '-25 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-25 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000030', 'BK-2609057-EP048', '90000000-0000-0000-0000-000000000209', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', '566e252d-b253-e515-5969-467b3d3a2b77', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '-25 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-25 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000031', 'BK-2609058-EP049', '90000000-0000-0000-0000-00000000020a', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '-26 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-26 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-27 days', '7a70d6c6-82fb-e926-f76e-a824384abd12'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000032', 'BK-2609059-EP050', '90000000-0000-0000-0000-00000000020b', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6',
    (CURRENT_DATE + INTERVAL '-26 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-26 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nhi khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000033', 'BK-2609060-EP051', '90000000-0000-0000-0000-00000000020c', '0f49100f-3940-a9a2-f9d9-792b4a265768', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '-27 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-27 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000034', 'BK-2609061-EP052', '80000000-0000-0000-0002-000000000001', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '6eb091fd-ba5b-86dc-d21d-7ba22e7c7689', 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2',
    (CURRENT_DATE + INTERVAL '-27 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-27 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Cơ xương khớp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-28 days', '8d47632e-e4d1-82a5-30f6-2d88fad7f176'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000035', 'BK-2609062-EP053', '80000000-0000-0000-0002-000000000002', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2',
    (CURRENT_DATE + INTERVAL '-28 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-28 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Cơ xương khớp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000036', 'BK-2609063-EP054', '80000000-0000-0000-0002-000000000003', '0fc63528-3464-37b2-8521-55b4869cd6ee', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '-28 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-28 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000037', 'BK-2609064-EP055', '80000000-0000-0000-0002-000000000004', '101f11a4-62d5-4242-255b-04e57ce36978', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-29 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-29 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-30 days', '3359a223-3b09-6aa1-7415-c6be16271649'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000038', 'BK-2609065-EP056', '80000000-0000-0000-0002-000000000001', '101f11a4-62d5-4242-255b-04e57ce36978', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-29 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-29 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000039', 'BK-2609066-EP057', '80000000-0000-0000-0002-000000000002', '11720150-2ace-a89b-a007-105862080cc4', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '-30 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-30 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000003a', 'BK-2609067-EP058', '80000000-0000-0000-0002-000000000003', '11720150-2ace-a89b-a007-105862080cc4', '83d56555-dc7c-f749-7271-04e0d1843da1', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '-30 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-30 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-31 days', '946ce7df-65e3-1a39-68ee-043db4ca6b3f'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000003b', 'BK-2609068-EP059', '80000000-0000-0000-0002-000000000004', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d', '83d56555-dc7c-f749-7271-04e0d1843da1', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '-31 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-31 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000003c', 'BK-2609069-EP060', '80000000-0000-0000-0002-000000000005', '12c784f2-ab72-014c-d70d-1893f093a555', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '-31 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-31 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000003d', 'BK-2609070-EP061', '80000000-0000-0000-0002-000000000006', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '-32 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-32 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-33 days', '938260f7-85fb-43d2-b9f6-b14c46a39e16'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000003e', 'BK-2609071-EP062', '80000000-0000-0000-0002-000000000007', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '-32 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-32 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000003f', 'BK-2609072-EP063', '80000000-0000-0000-0002-000000000008', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf',
    (CURRENT_DATE + INTERVAL '-33 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-33 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiêu hóa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000040', 'BK-2609073-EP064', '80000000-0000-0000-0002-000000000009', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '-33 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-33 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-34 days', '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000041', 'BK-2609074-EP065', '80000000-0000-0000-0002-00000000000a', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '83d56555-dc7c-f749-7271-04e0d1843da1', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '-34 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-34 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000042', 'BK-2609075-EP066', '80000000-0000-0000-0002-00000000000b', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6',
    (CURRENT_DATE + INTERVAL '-34 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-34 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nhi khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000043', 'BK-2609076-EP067', '80000000-0000-0000-0002-00000000000c', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '535f4437-1f68-4926-14c8-2e9d29a4f684', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '-35 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-35 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-36 days', '097bdfc5-d514-1245-b3fe-72e04d871339'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000044', 'BK-2609077-EP068', '80000000-0000-0000-0002-00000000000d', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '-35 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-35 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000045', 'BK-2609078-EP069', '80000000-0000-0000-0002-00000000000e', '0467b23c-312e-25b9-af98-761fd1fffa9f', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '-36 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-36 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000046', 'BK-2609079-EP070', '80000000-0000-0000-0002-00000000000f', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '-36 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-36 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-37 days', 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000047', 'BK-2609080-EP071', '90000000-0000-0000-0000-000000000004', '05152036-18cd-98a6-92a3-cfc64f6651dd', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-37 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-37 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000048', 'BK-2609081-EP072', '90000000-0000-0000-0000-000000000013', '05152036-18cd-98a6-92a3-cfc64f6651dd', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '-37 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-37 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000049', 'BK-2609082-EP073', '90000000-0000-0000-0000-000000000014', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '-38 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-38 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-39 days', '16931bc9-6b86-3cc4-de8e-53670e99ce41'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000004a', 'BK-2609083-EP074', '90000000-0000-0000-0000-000000000201', '05866f27-98b4-7fd9-4e46-2f281ede4098', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '-38 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-38 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000004b', 'BK-2609084-EP075', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098', '535f4437-1f68-4926-14c8-2e9d29a4f684', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '-39 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-39 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000004c', 'BK-2609085-EP076', '90000000-0000-0000-0000-000000000203', '0603349d-dfde-11a2-1033-50c3aa512b02', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '-39 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-39 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-40 days', '81ffe666-2065-f436-5a81-eb44eb6333fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000004d', 'BK-2609086-EP077', '90000000-0000-0000-0000-000000000204', '0603349d-dfde-11a2-1033-50c3aa512b02', 'c2fee201-d898-4f79-cf65-113f9af836c9', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '-40 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-40 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000004e', 'BK-2609087-EP078', '90000000-0000-0000-0000-000000000205', '06487368-ce38-e21c-36f9-3b0fa28de677', '890d18bd-1881-12e9-ff66-a5bd8a8dc5d0', '993e92ff-b71f-ae7c-090f-52572e5e3f11',
    (CURRENT_DATE + INTERVAL '-40 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-40 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Ung bướu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000004f', 'BK-2609088-EP079', '90000000-0000-0000-0000-000000000022', '071d8e82-0c9e-6671-9dd8-196d1071f373', '566e252d-b253-e515-5969-467b3d3a2b77', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '-41 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-41 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-42 days', '77823225-a569-2ce2-b913-4c6d71adfac8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000050', 'BK-2609089-EP080', '90000000-0000-0000-0000-000000000206', '071d8e82-0c9e-6671-9dd8-196d1071f373', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '-41 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-41 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000051', 'BK-2609090-EP081', '90000000-0000-0000-0000-000000000207', '083646c4-c3fa-3013-da09-e13691801fc5', '7e0b9ff7-9df7-8e06-fd86-f4456c9a35d2', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '-42 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-42 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000052', 'BK-2609091-EP082', '90000000-0000-0000-0000-000000000208', '083646c4-c3fa-3013-da09-e13691801fc5', 'c2fee201-d898-4f79-cf65-113f9af836c9', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '-42 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-42 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-43 days', '3bacd204-83af-68a6-9781-a12472ee71bf'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000053', 'BK-2609092-EP083', '90000000-0000-0000-0000-000000000209', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '7765688c-354a-229a-6704-e4e460ccf3fa', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '-43 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-43 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000054', 'BK-2609093-EP084', '90000000-0000-0000-0000-00000000020a', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '-43 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-43 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000055', 'BK-2609094-EP085', '90000000-0000-0000-0000-00000000020b', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '-44 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-44 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-45 days', '44efce0e-6734-a401-7714-50c710221fe2'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000056', 'BK-2609095-EP086', '90000000-0000-0000-0000-00000000020c', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '-44 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-44 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000057', 'BK-2609096-EP087', '80000000-0000-0000-0002-000000000001', '0a29aded-3774-021a-2b95-bb726ec11274', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '2eba03c7-5d06-d23a-e7cb-4f74926ff849',
    (CURRENT_DATE + INTERVAL '-45 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-45 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Phục hồi chức năng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000058', 'BK-2609097-EP088', '80000000-0000-0000-0002-000000000002', '0a8552db-6c07-6e3c-3930-4ef03b19008c', '7765688c-354a-229a-6704-e4e460ccf3fa', 'd7851b0f-8adf-f780-b818-eb7670ec1e92',
    (CURRENT_DATE + INTERVAL '-45 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-45 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Huyết học', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-46 days', '179579a2-744b-571e-7887-a371a50aa4f8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000059', 'BK-2609098-EP089', '80000000-0000-0000-0002-000000000003', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', '8c310c68-033f-55d4-19e3-d63ed466d120', '847f0834-7126-6c7d-bf07-610a46400a82',
    (CURRENT_DATE + INTERVAL '-46 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-46 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội tổng hợp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000005a', 'BK-2609099-EP090', '80000000-0000-0000-0002-000000000004', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b3379f28-d281-e976-0690-a0238f3b2038',
    (CURRENT_DATE + INTERVAL '-46 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-46 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y tế công cộng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000005b', 'BK-2609100-EP091', '80000000-0000-0000-0002-000000000001', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'b3379f28-d281-e976-0690-a0238f3b2038',
    (CURRENT_DATE + INTERVAL '-47 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-47 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Y tế công cộng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-48 days', '5d19a424-51c3-148f-b00a-14528aa09300'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000005c', 'BK-2609101-EP092', '80000000-0000-0000-0002-000000000002', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', '566e252d-b253-e515-5969-467b3d3a2b77', 'f5ca7735-d556-148a-ed43-65ca94e41ae5',
    (CURRENT_DATE + INTERVAL '-47 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-47 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Chấn thương chỉnh hình', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000005d', 'BK-2609102-EP093', '80000000-0000-0000-0002-000000000003', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c',
    (CURRENT_DATE + INTERVAL '-48 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-48 days')::date + '12:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội mạch máu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000005e', 'BK-2609103-EP094', '80000000-0000-0000-0002-000000000004', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'be4bd45f-857d-6836-c2e0-00bd6d6ad36c',
    (CURRENT_DATE + INTERVAL '-48 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-48 days')::date + '13:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Nội mạch máu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-49 days', 'a7fc3862-6ed1-b5f8-8803-02ddee4f6379'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000005f', 'BK-2609104-EP095', '80000000-0000-0000-0002-000000000005', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '83d56555-dc7c-f749-7271-04e0d1843da1', '9cb56149-95dd-a351-ca75-b9b2f559d83b',
    (CURRENT_DATE + INTERVAL '-49 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-49 days')::date + '14:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiết niệu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000060', 'BK-2609105-EP096', '80000000-0000-0000-0002-000000000006', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '9cb56149-95dd-a351-ca75-b9b2f559d83b',
    (CURRENT_DATE + INTERVAL '-49 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-49 days')::date + '15:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Tiết niệu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000061', 'BK-2609106-EP097', '80000000-0000-0000-0002-000000000007', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '7765688c-354a-229a-6704-e4e460ccf3fa', 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa',
    (CURRENT_DATE + INTERVAL '-50 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-50 days')::date + '08:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu thẩm mỹ', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-51 days', 'ed23f337-3ee2-8c5b-51a7-a5fb511cd00b'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000062', 'BK-2609107-EP098', '80000000-0000-0000-0002-000000000008', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', 'ad181ca3-d18b-0da9-3d51-23b6150ae1aa',
    (CURRENT_DATE + INTERVAL '-50 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-50 days')::date + '09:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Da liễu thẩm mỹ', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000063', 'BK-2609108-EP099', '80000000-0000-0000-0002-000000000009', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '131199e1-749b-4a18-0c68-9605d41cb0a6',
    (CURRENT_DATE + INTERVAL '-51 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '-51 days')::date + '10:00:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Thính học', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-52 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000064', 'BK-2609109-EP100', '80000000-0000-0000-0002-00000000000a', '0e333dc3-4388-6ae4-c059-f750302b16e0', '6eb091fd-ba5b-86dc-d21d-7ba22e7c7689', '63263a8f-985d-56bd-4a91-cbc635681fb3',
    (CURRENT_DATE + INTERVAL '-51 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '-51 days')::date + '11:30:00'::time)::timestamp with time zone,
    'COMPLETED', 'PAID', 'Khám và tư vấn chuyên khoa Ngoại khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-52 days', 'a94904c5-e237-4f3e-fa94-fb3e030df87b'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000065', 'BK-2609110-EP101', '80000000-0000-0000-0002-00000000000b', '0e51eada-c05e-4d5f-25e5-73aea8120dd3', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '462aa421-a88f-7105-7022-163467a83c2e',
    (CURRENT_DATE + INTERVAL '1 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '1 days')::date + '12:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Ngoại thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '0 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000066', 'BK-2609111-EP102', '80000000-0000-0000-0002-00000000000c', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '68c49671-774e-a89c-c9c1-b67a88de6bff',
    (CURRENT_DATE + INTERVAL '2 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '2 days')::date + '13:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Giải phẫu bệnh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000067', 'BK-2609112-EP103', '80000000-0000-0000-0002-00000000000d', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '68c49671-774e-a89c-c9c1-b67a88de6bff',
    (CURRENT_DATE + INTERVAL '3 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '3 days')::date + '14:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Giải phẫu bệnh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '2 days', 'eaa5b00f-0290-3672-945d-9ac715b07b3c'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000068', 'BK-2609113-EP104', '80000000-0000-0000-0002-00000000000e', '0e6cb13d-885f-c605-966a-13c0eaa951c1', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '4 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '4 days')::date + '15:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000069', 'BK-2609114-EP105', '80000000-0000-0000-0002-00000000000f', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95', '7765688c-354a-229a-6704-e4e460ccf3fa', '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf',
    (CURRENT_DATE + INTERVAL '5 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '5 days')::date + '08:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tiêu hóa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000006a', 'BK-2609115-EP106', '90000000-0000-0000-0000-000000000004', '0f0245c2-fd64-efb4-5561-83404f179a22', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '6 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '6 days')::date + '09:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '5 days', 'dbfb4e7f-da3d-57d3-3573-c26528482839'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000006b', 'BK-2609116-EP107', '90000000-0000-0000-0000-000000000013', '0f0245c2-fd64-efb4-5561-83404f179a22', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '7 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '7 days')::date + '10:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000006c', 'BK-2609117-EP108', '90000000-0000-0000-0000-000000000014', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', '566e252d-b253-e515-5969-467b3d3a2b77', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '8 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '8 days')::date + '11:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000006d', 'BK-2609118-EP109', '90000000-0000-0000-0000-000000000201', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '9 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '9 days')::date + '12:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '8 days', '7a70d6c6-82fb-e926-f76e-a824384abd12'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000006e', 'BK-2609119-EP110', '90000000-0000-0000-0000-000000000202', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6',
    (CURRENT_DATE + INTERVAL '10 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '10 days')::date + '13:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Nhi khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000006f', 'BK-2609120-EP111', '90000000-0000-0000-0000-000000000203', '0f49100f-3940-a9a2-f9d9-792b4a265768', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '11 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '11 days')::date + '14:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000070', 'BK-2609121-EP112', '90000000-0000-0000-0000-000000000204', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '6eb091fd-ba5b-86dc-d21d-7ba22e7c7689', 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2',
    (CURRENT_DATE + INTERVAL '12 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '12 days')::date + '15:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Cơ xương khớp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '11 days', '8d47632e-e4d1-82a5-30f6-2d88fad7f176'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000071', 'BK-2609122-EP113', '90000000-0000-0000-0000-000000000205', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'a9a176a3-00b5-0ed1-fb77-af6b1d7bd8d2',
    (CURRENT_DATE + INTERVAL '13 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '13 days')::date + '08:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Cơ xương khớp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000072', 'BK-2609123-EP114', '90000000-0000-0000-0000-000000000022', '0fc63528-3464-37b2-8521-55b4869cd6ee', 'f2738a9b-b915-9f55-8060-c825d70bfd1e', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '14 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '14 days')::date + '09:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000073', 'BK-2609124-EP115', '90000000-0000-0000-0000-000000000206', '101f11a4-62d5-4242-255b-04e57ce36978', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '15 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '15 days')::date + '10:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '14 days', '3359a223-3b09-6aa1-7415-c6be16271649'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000074', 'BK-2609125-EP116', '90000000-0000-0000-0000-000000000207', '101f11a4-62d5-4242-255b-04e57ce36978', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '16 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '16 days')::date + '11:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000075', 'BK-2609126-EP117', '90000000-0000-0000-0000-000000000208', '11720150-2ace-a89b-a007-105862080cc4', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '17 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '17 days')::date + '12:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000076', 'BK-2609127-EP118', '90000000-0000-0000-0000-000000000209', '11720150-2ace-a89b-a007-105862080cc4', '83d56555-dc7c-f749-7271-04e0d1843da1', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '18 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '18 days')::date + '13:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '17 days', '946ce7df-65e3-1a39-68ee-043db4ca6b3f'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000077', 'BK-2609128-EP119', '90000000-0000-0000-0000-00000000020a', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d', '83d56555-dc7c-f749-7271-04e0d1843da1', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '19 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '19 days')::date + '14:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000078', 'BK-2609129-EP120', '90000000-0000-0000-0000-00000000020b', '12c784f2-ab72-014c-d70d-1893f093a555', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '20 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '20 days')::date + '15:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000079', 'BK-2609130-EP121', '90000000-0000-0000-0000-00000000020c', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '7188f796-3d10-ca33-3d04-bfc7dab3932c', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '21 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '21 days')::date + '08:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '20 days', '938260f7-85fb-43d2-b9f6-b14c46a39e16'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000007a', 'BK-2609131-EP122', '80000000-0000-0000-0002-000000000001', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', '5c20abac-9079-f9db-2819-3cbf167603b5',
    (CURRENT_DATE + INTERVAL '22 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '22 days')::date + '09:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tim mạch', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000007b', 'BK-2609132-EP123', '80000000-0000-0000-0002-000000000002', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '7eb6b5c1-3f8d-48c9-c54e-e35be9524ebf',
    (CURRENT_DATE + INTERVAL '23 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '23 days')::date + '10:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tiêu hóa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000007c', 'BK-2609133-EP124', '80000000-0000-0000-0002-000000000003', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '82eecc5d-313f-8691-08f2-8adf830d567a',
    (CURRENT_DATE + INTERVAL '24 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '24 days')::date + '11:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Hô hấp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '23 days', '4c5024ec-29cb-e9d3-bce9-7805c9ef34fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000007d', 'BK-2609134-EP125', '80000000-0000-0000-0002-000000000004', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '83d56555-dc7c-f749-7271-04e0d1843da1', '3cd99926-6c7d-dd5b-183f-882ae9a0e469',
    (CURRENT_DATE + INTERVAL '25 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '25 days')::date + '12:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Thần kinh', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000007e', 'BK-2609135-EP126', '80000000-0000-0000-0002-000000000001', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b47e0424-db07-65b2-d1f4-fc4e290ae4d6',
    (CURRENT_DATE + INTERVAL '26 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '26 days')::date + '13:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Nhi khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000007f', 'BK-2609136-EP127', '80000000-0000-0000-0002-000000000002', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '535f4437-1f68-4926-14c8-2e9d29a4f684', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '27 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '27 days')::date + '14:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '26 days', '097bdfc5-d514-1245-b3fe-72e04d871339'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000080', 'BK-2609137-EP128', '80000000-0000-0000-0002-000000000003', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', '6a20be4b-ef6d-4d2f-b25d-11c2772440fd',
    (CURRENT_DATE + INTERVAL '28 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '28 days')::date + '15:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Sản phụ khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000081', 'BK-2609138-EP129', '80000000-0000-0000-0002-000000000004', '0467b23c-312e-25b9-af98-761fd1fffa9f', '7188f796-3d10-ca33-3d04-bfc7dab3932c', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '29 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '29 days')::date + '08:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000082', 'BK-2609139-EP130', '80000000-0000-0000-0002-000000000005', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', 'd45a7cb5-269a-f76f-0554-ad3da3906c51',
    (CURRENT_DATE + INTERVAL '30 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '30 days')::date + '09:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Nội tiết', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '29 days', 'f0f63287-50dd-36b4-b29d-07fbcf7a9f0a'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000083', 'BK-2609140-EP131', '80000000-0000-0000-0002-000000000006', '05152036-18cd-98a6-92a3-cfc64f6651dd', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '31 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '31 days')::date + '10:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000084', 'BK-2609141-EP132', '80000000-0000-0000-0002-000000000007', '05152036-18cd-98a6-92a3-cfc64f6651dd', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1f721cc1-8cfd-0d5e-0098-3bc9999b57b2',
    (CURRENT_DATE + INTERVAL '32 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '32 days')::date + '11:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Da liễu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000085', 'BK-2609142-EP133', '80000000-0000-0000-0002-000000000008', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'd2f61476-c56c-a8d9-ac80-0a1638ab1033', 'd898a94d-f778-a09e-a99c-060ebbbfd35e',
    (CURRENT_DATE + INTERVAL '33 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '33 days')::date + '12:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Tai mũi họng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '32 days', '16931bc9-6b86-3cc4-de8e-53670e99ce41'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000086', 'BK-2609143-EP134', '80000000-0000-0000-0002-000000000009', '05866f27-98b4-7fd9-4e46-2f281ede4098', '40fabad4-9bac-c3e0-9d20-43fdf9168eb5', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '34 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '34 days')::date + '13:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000087', 'BK-2609144-EP135', '80000000-0000-0000-0002-00000000000a', '05866f27-98b4-7fd9-4e46-2f281ede4098', '535f4437-1f68-4926-14c8-2e9d29a4f684', '7f80619b-9ece-f8d3-add2-12c4e6de963d',
    (CURRENT_DATE + INTERVAL '35 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '35 days')::date + '14:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Mắt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000088', 'BK-2609145-EP136', '80000000-0000-0000-0002-00000000000b', '0603349d-dfde-11a2-1033-50c3aa512b02', '85a7d1a5-ec91-61e1-fe4c-5231c723e7e8', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '36 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '36 days')::date + '15:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '35 days', '81ffe666-2065-f436-5a81-eb44eb6333fc'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000089', 'BK-2609146-EP137', '80000000-0000-0000-0002-00000000000c', '0603349d-dfde-11a2-1033-50c3aa512b02', 'c2fee201-d898-4f79-cf65-113f9af836c9', '2065b16f-10a5-3781-439c-62dba14e4b52',
    (CURRENT_DATE + INTERVAL '37 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '37 days')::date + '08:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Răng hàm mặt', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000008a', 'BK-2609147-EP138', '80000000-0000-0000-0002-00000000000d', '06487368-ce38-e21c-36f9-3b0fa28de677', '890d18bd-1881-12e9-ff66-a5bd8a8dc5d0', '993e92ff-b71f-ae7c-090f-52572e5e3f11',
    (CURRENT_DATE + INTERVAL '38 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '38 days')::date + '09:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Ung bướu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000008b', 'BK-2609148-EP139', '80000000-0000-0000-0002-00000000000e', '071d8e82-0c9e-6671-9dd8-196d1071f373', '566e252d-b253-e515-5969-467b3d3a2b77', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '39 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '39 days')::date + '10:00:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '38 days', '77823225-a569-2ce2-b913-4c6d71adfac8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000008c', 'BK-2609149-EP140', '80000000-0000-0000-0002-00000000000f', '071d8e82-0c9e-6671-9dd8-196d1071f373', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a0976d1-bede-f974-5422-b58a922f0183',
    (CURRENT_DATE + INTERVAL '40 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '40 days')::date + '11:30:00'::time)::timestamp with time zone,
    'CONFIRMED', 'UNPAID', 'Khám và tư vấn chuyên khoa Dinh dưỡng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000008d', 'BK-2609150-EP141', '90000000-0000-0000-0000-000000000004', '083646c4-c3fa-3013-da09-e13691801fc5', '7e0b9ff7-9df7-8e06-fd86-f4456c9a35d2', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '08:00:00'::time, '08:30:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '08:00:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-00000000008e', 'BK-2609151-EP142', '90000000-0000-0000-0000-000000000013', '083646c4-c3fa-3013-da09-e13691801fc5', 'c2fee201-d898-4f79-cf65-113f9af836c9', 'ed14e1ac-5fe8-7043-3f00-ed1262c5150b',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '09:30:00'::time, '10:00:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '09:30:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Sơ cấp cứu', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days', '3bacd204-83af-68a6-9781-a12472ee71bf'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-00000000008f', 'BK-2609152-EP143', '90000000-0000-0000-0000-000000000014', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '7765688c-354a-229a-6704-e4e460ccf3fa', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '10:00:00'::time, '10:30:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '10:00:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000090', 'BK-2609153-EP144', '90000000-0000-0000-0000-000000000201', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', 'c9eb17b1-996b-ef18-1057-7f6c9a550da0',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '11:30:00'::time, '12:00:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '11:30:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Nam khoa', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000091', 'BK-2609154-EP145', '90000000-0000-0000-0000-000000000202', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '73309ada-e187-201f-1ba5-fb7b2a0ec7a1', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '12:00:00'::time, '12:30:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '12:00:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days', '44efce0e-6734-a401-7714-50c710221fe2'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000092', 'BK-2609155-EP146', '90000000-0000-0000-0000-000000000203', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '1a969127-309d-a67b-6460-48a75535074d',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '13:30:00'::time, '14:00:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '13:30:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Y học cổ truyền', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000093', 'BK-2609156-EP147', '90000000-0000-0000-0000-000000000204', '0a29aded-3774-021a-2b95-bb726ec11274', 'c90115d2-40e8-79a1-75b9-dd233cd6d7ed', '2eba03c7-5d06-d23a-e7cb-4f74926ff849',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '14:00:00'::time, '14:30:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '14:00:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Phục hồi chức năng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at, package_id
  ) VALUES (
    '80000000-0000-0000-0010-000000000094', 'BK-2609157-EP148', '90000000-0000-0000-0000-000000000205', '0a8552db-6c07-6e3c-3930-4ef03b19008c', '7765688c-354a-229a-6704-e4e460ccf3fa', 'd7851b0f-8adf-f780-b818-eb7670ec1e92',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '15:30:00'::time, '16:00:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '15:30:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Huyết học', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days', '179579a2-744b-571e-7887-a371a50aa4f8'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000095', 'BK-2609158-EP149', '90000000-0000-0000-0000-000000000022', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', '8c310c68-033f-55d4-19e3-d63ed466d120', '847f0834-7126-6c7d-bf07-610a46400a82',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '16:00:00'::time, '16:30:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '16:00:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Nội tổng hợp', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointments (
    id, booking_code, patient_id, doctor_id, branch_id, specialty_id,
    appointment_date, start_time, end_time, appointment_time,
    status, payment_status, reason_for_visit, notes,
    has_insurance, otp_attempts, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0010-000000000096', 'BK-2609159-EP150', '90000000-0000-0000-0000-000000000206', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '7765688c-354a-229a-6704-e4e460ccf3fa', 'b3379f28-d281-e976-0690-a0238f3b2038',
    (CURRENT_DATE + INTERVAL '0 days')::date,
    '17:30:00'::time, '18:00:00'::time,
    ((CURRENT_DATE + INTERVAL '0 days')::date + '17:30:00'::time)::timestamp with time zone,
    'IN_PROGRESS', 'PAID', 'Khám và tư vấn chuyên khoa Y tế công cộng', 'Bệnh nhân tái khám định kỳ theo hẹn.',
    false, 0, false, CURRENT_TIMESTAMP + INTERVAL '-1 days'
  ) ON CONFLICT (id) DO NOTHING;


-- 3. Appointment Account Claims (100 rows)

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000001', '80000000-0000-0000-0010-000000000001', '90000000-0000-0000-0000-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000002', '80000000-0000-0000-0010-000000000002', '90000000-0000-0000-0000-000000000011', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000003', '80000000-0000-0000-0010-000000000003', '90000000-0000-0000-0000-000000000012', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000004', '80000000-0000-0000-0010-000000000004', '90000000-0000-0000-0000-000000000101', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000005', '80000000-0000-0000-0010-000000000005', '90000000-0000-0000-0000-000000000102', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000006', '80000000-0000-0000-0010-000000000006', '90000000-0000-0000-0000-000000000103', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000007', '80000000-0000-0000-0010-000000000007', '90000000-0000-0000-0000-000000000104', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000008', '80000000-0000-0000-0010-000000000008', '90000000-0000-0000-0000-000000000105', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000009', '80000000-0000-0000-0010-000000000009', '90000000-0000-0000-0000-000000000021', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000a', '80000000-0000-0000-0010-00000000000a', '90000000-0000-0000-0000-000000000106', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000b', '80000000-0000-0000-0010-00000000000b', '90000000-0000-0000-0000-000000000107', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000c', '80000000-0000-0000-0010-00000000000c', '90000000-0000-0000-0000-000000000108', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000d', '80000000-0000-0000-0010-00000000000d', '90000000-0000-0000-0000-000000000109', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000e', '80000000-0000-0000-0010-00000000000e', '90000000-0000-0000-0000-00000000010a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000000f', '80000000-0000-0000-0010-00000000000f', '90000000-0000-0000-0000-00000000010b', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000010', '80000000-0000-0000-0010-000000000010', '90000000-0000-0000-0000-00000000010c', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000011', '80000000-0000-0000-0010-000000000011', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000012', '80000000-0000-0000-0010-000000000012', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000013', '80000000-0000-0000-0010-000000000013', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000014', '80000000-0000-0000-0010-000000000014', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000015', '80000000-0000-0000-0010-000000000015', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000016', '80000000-0000-0000-0010-000000000016', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000017', '80000000-0000-0000-0010-000000000017', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000018', '80000000-0000-0000-0010-000000000018', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000019', '80000000-0000-0000-0010-000000000019', '80000000-0000-0000-0001-000000000005', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001a', '80000000-0000-0000-0010-00000000001a', '80000000-0000-0000-0001-000000000006', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001b', '80000000-0000-0000-0010-00000000001b', '80000000-0000-0000-0001-000000000007', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001c', '80000000-0000-0000-0010-00000000001c', '80000000-0000-0000-0001-000000000008', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001d', '80000000-0000-0000-0010-00000000001d', '80000000-0000-0000-0001-000000000009', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-16 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001e', '80000000-0000-0000-0010-00000000001e', '80000000-0000-0000-0001-00000000000a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-16 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000001f', '80000000-0000-0000-0010-00000000001f', '80000000-0000-0000-0001-00000000000b', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-17 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000020', '80000000-0000-0000-0010-000000000020', '80000000-0000-0000-0001-00000000000c', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-17 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000021', '80000000-0000-0000-0010-000000000021', '80000000-0000-0000-0001-00000000000d', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-18 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000022', '80000000-0000-0000-0010-000000000022', '80000000-0000-0000-0001-00000000000e', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-18 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000023', '80000000-0000-0000-0010-000000000023', '80000000-0000-0000-0001-00000000000f', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-19 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000024', '80000000-0000-0000-0010-000000000024', '90000000-0000-0000-0000-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-19 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000025', '80000000-0000-0000-0010-000000000025', '90000000-0000-0000-0000-000000000011', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000026', '80000000-0000-0000-0010-000000000026', '90000000-0000-0000-0000-000000000012', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000027', '80000000-0000-0000-0010-000000000027', '90000000-0000-0000-0000-000000000101', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-21 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000028', '80000000-0000-0000-0010-000000000028', '90000000-0000-0000-0000-000000000102', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-21 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000029', '80000000-0000-0000-0010-000000000029', '90000000-0000-0000-0000-000000000103', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-22 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002a', '80000000-0000-0000-0010-00000000002a', '90000000-0000-0000-0000-000000000104', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-22 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002b', '80000000-0000-0000-0010-00000000002b', '90000000-0000-0000-0000-000000000105', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-23 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002c', '80000000-0000-0000-0010-00000000002c', '90000000-0000-0000-0000-000000000021', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-23 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002d', '80000000-0000-0000-0010-00000000002d', '90000000-0000-0000-0000-000000000106', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-24 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002e', '80000000-0000-0000-0010-00000000002e', '90000000-0000-0000-0000-000000000107', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-24 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000002f', '80000000-0000-0000-0010-00000000002f', '90000000-0000-0000-0000-000000000108', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000030', '80000000-0000-0000-0010-000000000030', '90000000-0000-0000-0000-000000000109', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000031', '80000000-0000-0000-0010-000000000031', '90000000-0000-0000-0000-00000000010a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-26 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000032', '80000000-0000-0000-0010-000000000032', '90000000-0000-0000-0000-00000000010b', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-26 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000033', '80000000-0000-0000-0010-000000000033', '90000000-0000-0000-0000-00000000010c', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-27 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000034', '80000000-0000-0000-0010-000000000034', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-27 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000035', '80000000-0000-0000-0010-000000000035', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-28 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000036', '80000000-0000-0000-0010-000000000036', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-28 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000037', '80000000-0000-0000-0010-000000000037', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-29 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000038', '80000000-0000-0000-0010-000000000038', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-29 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000039', '80000000-0000-0000-0010-000000000039', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-30 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003a', '80000000-0000-0000-0010-00000000003a', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-30 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003b', '80000000-0000-0000-0010-00000000003b', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-31 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003c', '80000000-0000-0000-0010-00000000003c', '80000000-0000-0000-0001-000000000005', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-31 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003d', '80000000-0000-0000-0010-00000000003d', '80000000-0000-0000-0001-000000000006', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-32 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003e', '80000000-0000-0000-0010-00000000003e', '80000000-0000-0000-0001-000000000007', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-32 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000003f', '80000000-0000-0000-0010-00000000003f', '80000000-0000-0000-0001-000000000008', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-33 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000040', '80000000-0000-0000-0010-000000000040', '80000000-0000-0000-0001-000000000009', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-33 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000041', '80000000-0000-0000-0010-000000000041', '80000000-0000-0000-0001-00000000000a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-34 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000042', '80000000-0000-0000-0010-000000000042', '80000000-0000-0000-0001-00000000000b', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-34 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000043', '80000000-0000-0000-0010-000000000043', '80000000-0000-0000-0001-00000000000c', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-35 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000044', '80000000-0000-0000-0010-000000000044', '80000000-0000-0000-0001-00000000000d', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-35 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000045', '80000000-0000-0000-0010-000000000045', '80000000-0000-0000-0001-00000000000e', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-36 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000046', '80000000-0000-0000-0010-000000000046', '80000000-0000-0000-0001-00000000000f', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-36 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000047', '80000000-0000-0000-0010-000000000047', '90000000-0000-0000-0000-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-37 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000048', '80000000-0000-0000-0010-000000000048', '90000000-0000-0000-0000-000000000011', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-37 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000049', '80000000-0000-0000-0010-000000000049', '90000000-0000-0000-0000-000000000012', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-38 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004a', '80000000-0000-0000-0010-00000000004a', '90000000-0000-0000-0000-000000000101', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-38 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004b', '80000000-0000-0000-0010-00000000004b', '90000000-0000-0000-0000-000000000102', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-39 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004c', '80000000-0000-0000-0010-00000000004c', '90000000-0000-0000-0000-000000000103', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-39 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004d', '80000000-0000-0000-0010-00000000004d', '90000000-0000-0000-0000-000000000104', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-40 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004e', '80000000-0000-0000-0010-00000000004e', '90000000-0000-0000-0000-000000000105', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-40 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000004f', '80000000-0000-0000-0010-00000000004f', '90000000-0000-0000-0000-000000000021', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-41 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000050', '80000000-0000-0000-0010-000000000050', '90000000-0000-0000-0000-000000000106', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-41 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000051', '80000000-0000-0000-0010-000000000051', '90000000-0000-0000-0000-000000000107', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-42 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000052', '80000000-0000-0000-0010-000000000052', '90000000-0000-0000-0000-000000000108', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-42 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000053', '80000000-0000-0000-0010-000000000053', '90000000-0000-0000-0000-000000000109', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-43 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000054', '80000000-0000-0000-0010-000000000054', '90000000-0000-0000-0000-00000000010a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-43 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000055', '80000000-0000-0000-0010-000000000055', '90000000-0000-0000-0000-00000000010b', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-44 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000056', '80000000-0000-0000-0010-000000000056', '90000000-0000-0000-0000-00000000010c', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-44 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000057', '80000000-0000-0000-0010-000000000057', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-45 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000058', '80000000-0000-0000-0010-000000000058', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-45 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000059', '80000000-0000-0000-0010-000000000059', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-46 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005a', '80000000-0000-0000-0010-00000000005a', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-46 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005b', '80000000-0000-0000-0010-00000000005b', '80000000-0000-0000-0001-000000000001', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-47 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005c', '80000000-0000-0000-0010-00000000005c', '80000000-0000-0000-0001-000000000002', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-47 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005d', '80000000-0000-0000-0010-00000000005d', '80000000-0000-0000-0001-000000000003', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-48 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005e', '80000000-0000-0000-0010-00000000005e', '80000000-0000-0000-0001-000000000004', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-48 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-00000000005f', '80000000-0000-0000-0010-00000000005f', '80000000-0000-0000-0001-000000000005', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-49 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000060', '80000000-0000-0000-0010-000000000060', '80000000-0000-0000-0001-000000000006', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-49 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000061', '80000000-0000-0000-0010-000000000061', '80000000-0000-0000-0001-000000000007', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-50 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000062', '80000000-0000-0000-0010-000000000062', '80000000-0000-0000-0001-000000000008', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-50 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000063', '80000000-0000-0000-0010-000000000063', '80000000-0000-0000-0001-000000000009', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-51 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO appointment_account_claims (id, appointment_id, user_id, claim_source, claimed_at)
  VALUES ('80000000-0000-0000-0015-000000000064', '80000000-0000-0000-0010-000000000064', '80000000-0000-0000-0001-00000000000a', 'BOOKING_OTP', CURRENT_TIMESTAMP + INTERVAL '-51 days')
  ON CONFLICT (id) DO NOTHING;


-- 4. Medical Records (100 rows)

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000001', '80000000-0000-0000-0010-000000000001', '90000000-0000-0000-0000-000000000004', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000002', '80000000-0000-0000-0010-000000000002', '90000000-0000-0000-0000-000000000013', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000003', '80000000-0000-0000-0010-000000000003', '90000000-0000-0000-0000-000000000014', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000004', '80000000-0000-0000-0010-000000000004', '90000000-0000-0000-0000-000000000201', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000005', '80000000-0000-0000-0010-000000000005', '90000000-0000-0000-0000-000000000202', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000006', '80000000-0000-0000-0010-000000000006', '90000000-0000-0000-0000-000000000203', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000007', '80000000-0000-0000-0010-000000000007', '90000000-0000-0000-0000-000000000204', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000008', '80000000-0000-0000-0010-000000000008', '90000000-0000-0000-0000-000000000205', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000009', '80000000-0000-0000-0010-000000000009', '90000000-0000-0000-0000-000000000022', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000a', '80000000-0000-0000-0010-00000000000a', '90000000-0000-0000-0000-000000000206', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000b', '80000000-0000-0000-0010-00000000000b', '90000000-0000-0000-0000-000000000207', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000c', '80000000-0000-0000-0010-00000000000c', '90000000-0000-0000-0000-000000000208', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000d', '80000000-0000-0000-0010-00000000000d', '90000000-0000-0000-0000-000000000209', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000e', '80000000-0000-0000-0010-00000000000e', '90000000-0000-0000-0000-00000000020a', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000000f', '80000000-0000-0000-0010-00000000000f', '90000000-0000-0000-0000-00000000020b', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000010', '80000000-0000-0000-0010-000000000010', '90000000-0000-0000-0000-00000000020c', '0603349d-dfde-11a2-1033-50c3aa512b02', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000011', '80000000-0000-0000-0010-000000000011', '80000000-0000-0000-0002-000000000001', '0603349d-dfde-11a2-1033-50c3aa512b02', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000012', '80000000-0000-0000-0010-000000000012', '80000000-0000-0000-0002-000000000002', '06487368-ce38-e21c-36f9-3b0fa28de677', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000013', '80000000-0000-0000-0010-000000000013', '80000000-0000-0000-0002-000000000003', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000014', '80000000-0000-0000-0010-000000000014', '80000000-0000-0000-0002-000000000004', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000015', '80000000-0000-0000-0010-000000000015', '80000000-0000-0000-0002-000000000001', '083646c4-c3fa-3013-da09-e13691801fc5', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000016', '80000000-0000-0000-0010-000000000016', '80000000-0000-0000-0002-000000000002', '083646c4-c3fa-3013-da09-e13691801fc5', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000017', '80000000-0000-0000-0010-000000000017', '80000000-0000-0000-0002-000000000003', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000018', '80000000-0000-0000-0010-000000000018', '80000000-0000-0000-0002-000000000004', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000019', '80000000-0000-0000-0010-000000000019', '80000000-0000-0000-0002-000000000005', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001a', '80000000-0000-0000-0010-00000000001a', '80000000-0000-0000-0002-000000000006', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001b', '80000000-0000-0000-0010-00000000001b', '80000000-0000-0000-0002-000000000007', '0a29aded-3774-021a-2b95-bb726ec11274', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001c', '80000000-0000-0000-0010-00000000001c', '80000000-0000-0000-0002-000000000008', '0a8552db-6c07-6e3c-3930-4ef03b19008c', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001d', '80000000-0000-0000-0010-00000000001d', '80000000-0000-0000-0002-000000000009', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001e', '80000000-0000-0000-0010-00000000001e', '80000000-0000-0000-0002-00000000000a', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000001f', '80000000-0000-0000-0010-00000000001f', '80000000-0000-0000-0002-00000000000b', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000020', '80000000-0000-0000-0010-000000000020', '80000000-0000-0000-0002-00000000000c', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000021', '80000000-0000-0000-0010-000000000021', '80000000-0000-0000-0002-00000000000d', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000022', '80000000-0000-0000-0010-000000000022', '80000000-0000-0000-0002-00000000000e', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000023', '80000000-0000-0000-0010-000000000023', '80000000-0000-0000-0002-00000000000f', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000024', '80000000-0000-0000-0010-000000000024', '90000000-0000-0000-0000-000000000004', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000025', '80000000-0000-0000-0010-000000000025', '90000000-0000-0000-0000-000000000013', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000026', '80000000-0000-0000-0010-000000000026', '90000000-0000-0000-0000-000000000014', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000027', '80000000-0000-0000-0010-000000000027', '90000000-0000-0000-0000-000000000201', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000028', '80000000-0000-0000-0010-000000000028', '90000000-0000-0000-0000-000000000202', '0e333dc3-4388-6ae4-c059-f750302b16e0', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000029', '80000000-0000-0000-0010-000000000029', '90000000-0000-0000-0000-000000000203', '0e51eada-c05e-4d5f-25e5-73aea8120dd3', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002a', '80000000-0000-0000-0010-00000000002a', '90000000-0000-0000-0000-000000000204', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002b', '80000000-0000-0000-0010-00000000002b', '90000000-0000-0000-0000-000000000205', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002c', '80000000-0000-0000-0010-00000000002c', '90000000-0000-0000-0000-000000000022', '0e6cb13d-885f-c605-966a-13c0eaa951c1', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002d', '80000000-0000-0000-0010-00000000002d', '90000000-0000-0000-0000-000000000206', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002e', '80000000-0000-0000-0010-00000000002e', '90000000-0000-0000-0000-000000000207', '0f0245c2-fd64-efb4-5561-83404f179a22', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000002f', '80000000-0000-0000-0010-00000000002f', '90000000-0000-0000-0000-000000000208', '0f0245c2-fd64-efb4-5561-83404f179a22', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000030', '80000000-0000-0000-0010-000000000030', '90000000-0000-0000-0000-000000000209', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000031', '80000000-0000-0000-0010-000000000031', '90000000-0000-0000-0000-00000000020a', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000032', '80000000-0000-0000-0010-000000000032', '90000000-0000-0000-0000-00000000020b', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000033', '80000000-0000-0000-0010-000000000033', '90000000-0000-0000-0000-00000000020c', '0f49100f-3940-a9a2-f9d9-792b4a265768', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000034', '80000000-0000-0000-0010-000000000034', '80000000-0000-0000-0002-000000000001', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000035', '80000000-0000-0000-0010-000000000035', '80000000-0000-0000-0002-000000000002', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000036', '80000000-0000-0000-0010-000000000036', '80000000-0000-0000-0002-000000000003', '0fc63528-3464-37b2-8521-55b4869cd6ee', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000037', '80000000-0000-0000-0010-000000000037', '80000000-0000-0000-0002-000000000004', '101f11a4-62d5-4242-255b-04e57ce36978', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000038', '80000000-0000-0000-0010-000000000038', '80000000-0000-0000-0002-000000000001', '101f11a4-62d5-4242-255b-04e57ce36978', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000039', '80000000-0000-0000-0010-000000000039', '80000000-0000-0000-0002-000000000002', '11720150-2ace-a89b-a007-105862080cc4', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003a', '80000000-0000-0000-0010-00000000003a', '80000000-0000-0000-0002-000000000003', '11720150-2ace-a89b-a007-105862080cc4', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003b', '80000000-0000-0000-0010-00000000003b', '80000000-0000-0000-0002-000000000004', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003c', '80000000-0000-0000-0010-00000000003c', '80000000-0000-0000-0002-000000000005', '12c784f2-ab72-014c-d70d-1893f093a555', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003d', '80000000-0000-0000-0010-00000000003d', '80000000-0000-0000-0002-000000000006', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003e', '80000000-0000-0000-0010-00000000003e', '80000000-0000-0000-0002-000000000007', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000003f', '80000000-0000-0000-0010-00000000003f', '80000000-0000-0000-0002-000000000008', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000040', '80000000-0000-0000-0010-000000000040', '80000000-0000-0000-0002-000000000009', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000041', '80000000-0000-0000-0010-000000000041', '80000000-0000-0000-0002-00000000000a', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000042', '80000000-0000-0000-0010-000000000042', '80000000-0000-0000-0002-00000000000b', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000043', '80000000-0000-0000-0010-000000000043', '80000000-0000-0000-0002-00000000000c', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000044', '80000000-0000-0000-0010-000000000044', '80000000-0000-0000-0002-00000000000d', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000045', '80000000-0000-0000-0010-000000000045', '80000000-0000-0000-0002-00000000000e', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000046', '80000000-0000-0000-0010-000000000046', '80000000-0000-0000-0002-00000000000f', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000047', '80000000-0000-0000-0010-000000000047', '90000000-0000-0000-0000-000000000004', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000048', '80000000-0000-0000-0010-000000000048', '90000000-0000-0000-0000-000000000013', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000049', '80000000-0000-0000-0010-000000000049', '90000000-0000-0000-0000-000000000014', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004a', '80000000-0000-0000-0010-00000000004a', '90000000-0000-0000-0000-000000000201', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004b', '80000000-0000-0000-0010-00000000004b', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004c', '80000000-0000-0000-0010-00000000004c', '90000000-0000-0000-0000-000000000203', '0603349d-dfde-11a2-1033-50c3aa512b02', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004d', '80000000-0000-0000-0010-00000000004d', '90000000-0000-0000-0000-000000000204', '0603349d-dfde-11a2-1033-50c3aa512b02', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004e', '80000000-0000-0000-0010-00000000004e', '90000000-0000-0000-0000-000000000205', '06487368-ce38-e21c-36f9-3b0fa28de677', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000004f', '80000000-0000-0000-0010-00000000004f', '90000000-0000-0000-0000-000000000022', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000050', '80000000-0000-0000-0010-000000000050', '90000000-0000-0000-0000-000000000206', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000051', '80000000-0000-0000-0010-000000000051', '90000000-0000-0000-0000-000000000207', '083646c4-c3fa-3013-da09-e13691801fc5', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000052', '80000000-0000-0000-0010-000000000052', '90000000-0000-0000-0000-000000000208', '083646c4-c3fa-3013-da09-e13691801fc5', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000053', '80000000-0000-0000-0010-000000000053', '90000000-0000-0000-0000-000000000209', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000054', '80000000-0000-0000-0010-000000000054', '90000000-0000-0000-0000-00000000020a', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000055', '80000000-0000-0000-0010-000000000055', '90000000-0000-0000-0000-00000000020b', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000056', '80000000-0000-0000-0010-000000000056', '90000000-0000-0000-0000-00000000020c', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000057', '80000000-0000-0000-0010-000000000057', '80000000-0000-0000-0002-000000000001', '0a29aded-3774-021a-2b95-bb726ec11274', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000058', '80000000-0000-0000-0010-000000000058', '80000000-0000-0000-0002-000000000002', '0a8552db-6c07-6e3c-3930-4ef03b19008c', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000059', '80000000-0000-0000-0010-000000000059', '80000000-0000-0000-0002-000000000003', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005a', '80000000-0000-0000-0010-00000000005a', '80000000-0000-0000-0002-000000000004', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005b', '80000000-0000-0000-0010-00000000005b', '80000000-0000-0000-0002-000000000001', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'I10', 'Tăng huyết áp vô căn (nguyên phát)',
    'Tăng huyết áp độ 2 theo ESH/ESC, nguy cơ tim mạch trung bình.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    145, 92, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005c', '80000000-0000-0000-0010-00000000005c', '80000000-0000-0000-0002-000000000002', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', 'E11.9', 'Đái tháo đường typ 2 không có biến chứng',
    'Đái tháo đường typ 2 mới phát hiện, kiểm soát đường huyết chưa đạt mục tiêu.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 82, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005d', '80000000-0000-0000-0010-00000000005d', '80000000-0000-0000-0002-000000000003', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'K21.0', 'Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Viêm thực quản trào ngược độ B theo Los Angeles, viêm phù nề hang vị.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005e', '80000000-0000-0000-0010-00000000005e', '80000000-0000-0000-0002-000000000004', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'M17.0', 'Thoái hóa khớp gối nguyên phát hai bên',
    'Thoái hóa khớp gối nguyên phát giai đoạn 2 theo Kellgren-Lawrence.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    128, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-00000000005f', '80000000-0000-0000-0010-00000000005f', '80000000-0000-0000-0002-000000000005', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'G43.9', 'Đau nửa đầu Migraine không đặc hiệu',
    'Đau đầu Migraine thể không có aura, đáp ứng tốt với giảm đau chọn lọc.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    118, 75, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000060', '80000000-0000-0000-0010-000000000060', '80000000-0000-0000-0002-000000000006', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'H81.0', 'Rối loạn tiền đình (bệnh Ménière)',
    'Rối loạn tiền đình ngoại biên cấp tính, triệu chứng chóng mặt tư thế.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    122, 80, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000061', '80000000-0000-0000-0010-000000000061', '80000000-0000-0000-0002-000000000007', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'J45.9', 'Hen phế quản không đặc hiệu',
    'Hen phế quản bậc 2 theo GINA, kiểm soát một phần.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    125, 78, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000062', '80000000-0000-0000-0010-000000000062', '80000000-0000-0000-0002-000000000008', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'J06.9', 'Nhiễm khuẩn hô hấp trên cấp tính',
    'Viêm mũi họng cấp tính do thời tiết, chưa có bội nhiễm phế quản.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    115, 74, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000063', '80000000-0000-0000-0010-000000000063', '80000000-0000-0000-0002-000000000009', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', 'E04.1', 'Bướu nhân tuyến giáp đơn độc lành tính',
    'Nhân giáp thùy phải TIRADS 3 kích thước 12x8mm, chức năng tuyến giáp bình thường.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    120, 76, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO medical_records (
    id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name,
    diagnosis, symptoms_summary, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature, weight_kg, height_cm, treatment_plan,
    doctor_notes, follow_up_date, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0020-000000000064', '80000000-0000-0000-0010-000000000064', '80000000-0000-0000-0002-00000000000a', '0e333dc3-4388-6ae4-c059-f750302b16e0', 'N20.0', 'Sỏi thận và sỏi niệu quản',
    'Sỏi đài dưới thận phải kích thước 6mm, chưa gây ứ nước đài bể thận.', 'Bệnh nhân có triệu chứng mệt mỏi, tái khám theo dõi tiến triển.',
    130, 85, 76, 36.8, 62.5, 165.0,
    'Điều trị ngoại trú kết hợp chế độ dinh dưỡng, vận động thể lực và dùng thuốc đúng chỉ dẫn.',
    'Hẹn tái khám sau 30 ngày hoặc khi có dấu hiệu bất thường.', (CURRENT_DATE + INTERVAL '30 days')::date,
    CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;


-- 5. Diagnostic Orders & Results (100 orders, 100 results)

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000001', '90000000-0000-0000-0000-000000000004', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '80000000-0000-0000-0010-000000000001', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000001', '80000000-0000-0000-0030-000000000001', '90000000-0000-0000-0000-000000000004', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000002', '90000000-0000-0000-0000-000000000013', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '80000000-0000-0000-0010-000000000002', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000002', '80000000-0000-0000-0030-000000000002', '90000000-0000-0000-0000-000000000013', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000003', '90000000-0000-0000-0000-000000000014', '014624fb-6e10-8a38-b903-dcd2b742a8b1', '80000000-0000-0000-0010-000000000003', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000003', '80000000-0000-0000-0030-000000000003', '90000000-0000-0000-0000-000000000014', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000004', '90000000-0000-0000-0000-000000000201', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', '80000000-0000-0000-0010-000000000004', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000004', '80000000-0000-0000-0030-000000000004', '90000000-0000-0000-0000-000000000201', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000005', '90000000-0000-0000-0000-000000000202', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '80000000-0000-0000-0010-000000000005', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000005', '80000000-0000-0000-0030-000000000005', '90000000-0000-0000-0000-000000000202', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000006', '90000000-0000-0000-0000-000000000203', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '80000000-0000-0000-0010-000000000006', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000006', '80000000-0000-0000-0030-000000000006', '90000000-0000-0000-0000-000000000203', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000007', '90000000-0000-0000-0000-000000000204', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '80000000-0000-0000-0010-000000000007', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000007', '80000000-0000-0000-0030-000000000007', '90000000-0000-0000-0000-000000000204', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000008', '90000000-0000-0000-0000-000000000205', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '80000000-0000-0000-0010-000000000008', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000008', '80000000-0000-0000-0030-000000000008', '90000000-0000-0000-0000-000000000205', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000009', '90000000-0000-0000-0000-000000000022', '0467b23c-312e-25b9-af98-761fd1fffa9f', '80000000-0000-0000-0010-000000000009', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000009', '80000000-0000-0000-0030-000000000009', '90000000-0000-0000-0000-000000000022', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000a', '90000000-0000-0000-0000-000000000206', '0467b23c-312e-25b9-af98-761fd1fffa9f', '80000000-0000-0000-0010-00000000000a', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000a', '80000000-0000-0000-0030-00000000000a', '90000000-0000-0000-0000-000000000206', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000b', '90000000-0000-0000-0000-000000000207', '05152036-18cd-98a6-92a3-cfc64f6651dd', '80000000-0000-0000-0010-00000000000b', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000b', '80000000-0000-0000-0030-00000000000b', '90000000-0000-0000-0000-000000000207', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000c', '90000000-0000-0000-0000-000000000208', '05152036-18cd-98a6-92a3-cfc64f6651dd', '80000000-0000-0000-0010-00000000000c', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000c', '80000000-0000-0000-0030-00000000000c', '90000000-0000-0000-0000-000000000208', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000d', '90000000-0000-0000-0000-000000000209', '0585c0d7-3646-f502-d80a-0adcb2b184f1', '80000000-0000-0000-0010-00000000000d', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000d', '80000000-0000-0000-0030-00000000000d', '90000000-0000-0000-0000-000000000209', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000e', '90000000-0000-0000-0000-00000000020a', '05866f27-98b4-7fd9-4e46-2f281ede4098', '80000000-0000-0000-0010-00000000000e', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000e', '80000000-0000-0000-0030-00000000000e', '90000000-0000-0000-0000-00000000020a', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000000f', '90000000-0000-0000-0000-00000000020b', '05866f27-98b4-7fd9-4e46-2f281ede4098', '80000000-0000-0000-0010-00000000000f', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000000f', '80000000-0000-0000-0030-00000000000f', '90000000-0000-0000-0000-00000000020b', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000010', '90000000-0000-0000-0000-00000000020c', '0603349d-dfde-11a2-1033-50c3aa512b02', '80000000-0000-0000-0010-000000000010', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000010', '80000000-0000-0000-0030-000000000010', '90000000-0000-0000-0000-00000000020c', '0603349d-dfde-11a2-1033-50c3aa512b02', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000011', '80000000-0000-0000-0002-000000000001', '0603349d-dfde-11a2-1033-50c3aa512b02', '80000000-0000-0000-0010-000000000011', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000011', '80000000-0000-0000-0030-000000000011', '80000000-0000-0000-0002-000000000001', '0603349d-dfde-11a2-1033-50c3aa512b02', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000012', '80000000-0000-0000-0002-000000000002', '06487368-ce38-e21c-36f9-3b0fa28de677', '80000000-0000-0000-0010-000000000012', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000012', '80000000-0000-0000-0030-000000000012', '80000000-0000-0000-0002-000000000002', '06487368-ce38-e21c-36f9-3b0fa28de677', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000013', '80000000-0000-0000-0002-000000000003', '071d8e82-0c9e-6671-9dd8-196d1071f373', '80000000-0000-0000-0010-000000000013', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000013', '80000000-0000-0000-0030-000000000013', '80000000-0000-0000-0002-000000000003', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000014', '80000000-0000-0000-0002-000000000004', '071d8e82-0c9e-6671-9dd8-196d1071f373', '80000000-0000-0000-0010-000000000014', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000014', '80000000-0000-0000-0030-000000000014', '80000000-0000-0000-0002-000000000004', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000015', '80000000-0000-0000-0002-000000000001', '083646c4-c3fa-3013-da09-e13691801fc5', '80000000-0000-0000-0010-000000000015', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000015', '80000000-0000-0000-0030-000000000015', '80000000-0000-0000-0002-000000000001', '083646c4-c3fa-3013-da09-e13691801fc5', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000016', '80000000-0000-0000-0002-000000000002', '083646c4-c3fa-3013-da09-e13691801fc5', '80000000-0000-0000-0010-000000000016', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000016', '80000000-0000-0000-0030-000000000016', '80000000-0000-0000-0002-000000000002', '083646c4-c3fa-3013-da09-e13691801fc5', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000017', '80000000-0000-0000-0002-000000000003', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '80000000-0000-0000-0010-000000000017', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000017', '80000000-0000-0000-0030-000000000017', '80000000-0000-0000-0002-000000000003', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000018', '80000000-0000-0000-0002-000000000004', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '80000000-0000-0000-0010-000000000018', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000018', '80000000-0000-0000-0030-000000000018', '80000000-0000-0000-0002-000000000004', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000019', '80000000-0000-0000-0002-000000000005', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '80000000-0000-0000-0010-000000000019', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000019', '80000000-0000-0000-0030-000000000019', '80000000-0000-0000-0002-000000000005', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001a', '80000000-0000-0000-0002-000000000006', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '80000000-0000-0000-0010-00000000001a', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001a', '80000000-0000-0000-0030-00000000001a', '80000000-0000-0000-0002-000000000006', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001b', '80000000-0000-0000-0002-000000000007', '0a29aded-3774-021a-2b95-bb726ec11274', '80000000-0000-0000-0010-00000000001b', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001b', '80000000-0000-0000-0030-00000000001b', '80000000-0000-0000-0002-000000000007', '0a29aded-3774-021a-2b95-bb726ec11274', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001c', '80000000-0000-0000-0002-000000000008', '0a8552db-6c07-6e3c-3930-4ef03b19008c', '80000000-0000-0000-0010-00000000001c', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001c', '80000000-0000-0000-0030-00000000001c', '80000000-0000-0000-0002-000000000008', '0a8552db-6c07-6e3c-3930-4ef03b19008c', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001d', '80000000-0000-0000-0002-000000000009', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', '80000000-0000-0000-0010-00000000001d', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001d', '80000000-0000-0000-0030-00000000001d', '80000000-0000-0000-0002-000000000009', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001e', '80000000-0000-0000-0002-00000000000a', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '80000000-0000-0000-0010-00000000001e', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001e', '80000000-0000-0000-0030-00000000001e', '80000000-0000-0000-0002-00000000000a', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000001f', '80000000-0000-0000-0002-00000000000b', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '80000000-0000-0000-0010-00000000001f', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000001f', '80000000-0000-0000-0030-00000000001f', '80000000-0000-0000-0002-00000000000b', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000020', '80000000-0000-0000-0002-00000000000c', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', '80000000-0000-0000-0010-000000000020', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000020', '80000000-0000-0000-0030-000000000020', '80000000-0000-0000-0002-00000000000c', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000021', '80000000-0000-0000-0002-00000000000d', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', '80000000-0000-0000-0010-000000000021', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000021', '80000000-0000-0000-0030-000000000021', '80000000-0000-0000-0002-00000000000d', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000022', '80000000-0000-0000-0002-00000000000e', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', '80000000-0000-0000-0010-000000000022', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000022', '80000000-0000-0000-0030-000000000022', '80000000-0000-0000-0002-00000000000e', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000023', '80000000-0000-0000-0002-00000000000f', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '80000000-0000-0000-0010-000000000023', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000023', '80000000-0000-0000-0030-000000000023', '80000000-0000-0000-0002-00000000000f', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000024', '90000000-0000-0000-0000-000000000004', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '80000000-0000-0000-0010-000000000024', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000024', '80000000-0000-0000-0030-000000000024', '90000000-0000-0000-0000-000000000004', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000025', '90000000-0000-0000-0000-000000000013', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '80000000-0000-0000-0010-000000000025', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000025', '80000000-0000-0000-0030-000000000025', '90000000-0000-0000-0000-000000000013', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000026', '90000000-0000-0000-0000-000000000014', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '80000000-0000-0000-0010-000000000026', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000026', '80000000-0000-0000-0030-000000000026', '90000000-0000-0000-0000-000000000014', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000027', '90000000-0000-0000-0000-000000000201', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', '80000000-0000-0000-0010-000000000027', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000027', '80000000-0000-0000-0030-000000000027', '90000000-0000-0000-0000-000000000201', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000028', '90000000-0000-0000-0000-000000000202', '0e333dc3-4388-6ae4-c059-f750302b16e0', '80000000-0000-0000-0010-000000000028', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000028', '80000000-0000-0000-0030-000000000028', '90000000-0000-0000-0000-000000000202', '0e333dc3-4388-6ae4-c059-f750302b16e0', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000029', '90000000-0000-0000-0000-000000000203', '0e51eada-c05e-4d5f-25e5-73aea8120dd3', '80000000-0000-0000-0010-000000000029', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000029', '80000000-0000-0000-0030-000000000029', '90000000-0000-0000-0000-000000000203', '0e51eada-c05e-4d5f-25e5-73aea8120dd3', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002a', '90000000-0000-0000-0000-000000000204', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '80000000-0000-0000-0010-00000000002a', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002a', '80000000-0000-0000-0030-00000000002a', '90000000-0000-0000-0000-000000000204', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002b', '90000000-0000-0000-0000-000000000205', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', '80000000-0000-0000-0010-00000000002b', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002b', '80000000-0000-0000-0030-00000000002b', '90000000-0000-0000-0000-000000000205', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002c', '90000000-0000-0000-0000-000000000022', '0e6cb13d-885f-c605-966a-13c0eaa951c1', '80000000-0000-0000-0010-00000000002c', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002c', '80000000-0000-0000-0030-00000000002c', '90000000-0000-0000-0000-000000000022', '0e6cb13d-885f-c605-966a-13c0eaa951c1', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002d', '90000000-0000-0000-0000-000000000206', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95', '80000000-0000-0000-0010-00000000002d', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002d', '80000000-0000-0000-0030-00000000002d', '90000000-0000-0000-0000-000000000206', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002e', '90000000-0000-0000-0000-000000000207', '0f0245c2-fd64-efb4-5561-83404f179a22', '80000000-0000-0000-0010-00000000002e', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002e', '80000000-0000-0000-0030-00000000002e', '90000000-0000-0000-0000-000000000207', '0f0245c2-fd64-efb4-5561-83404f179a22', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000002f', '90000000-0000-0000-0000-000000000208', '0f0245c2-fd64-efb4-5561-83404f179a22', '80000000-0000-0000-0010-00000000002f', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000002f', '80000000-0000-0000-0030-00000000002f', '90000000-0000-0000-0000-000000000208', '0f0245c2-fd64-efb4-5561-83404f179a22', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000030', '90000000-0000-0000-0000-000000000209', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', '80000000-0000-0000-0010-000000000030', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000030', '80000000-0000-0000-0030-000000000030', '90000000-0000-0000-0000-000000000209', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000031', '90000000-0000-0000-0000-00000000020a', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', '80000000-0000-0000-0010-000000000031', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000031', '80000000-0000-0000-0030-000000000031', '90000000-0000-0000-0000-00000000020a', '0f0c7281-cb72-35ac-d7ba-e9106a543aea', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000032', '90000000-0000-0000-0000-00000000020b', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9', '80000000-0000-0000-0010-000000000032', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000032', '80000000-0000-0000-0030-000000000032', '90000000-0000-0000-0000-00000000020b', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000033', '90000000-0000-0000-0000-00000000020c', '0f49100f-3940-a9a2-f9d9-792b4a265768', '80000000-0000-0000-0010-000000000033', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000033', '80000000-0000-0000-0030-000000000033', '90000000-0000-0000-0000-00000000020c', '0f49100f-3940-a9a2-f9d9-792b4a265768', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000034', '80000000-0000-0000-0002-000000000001', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '80000000-0000-0000-0010-000000000034', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000034', '80000000-0000-0000-0030-000000000034', '80000000-0000-0000-0002-000000000001', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000035', '80000000-0000-0000-0002-000000000002', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', '80000000-0000-0000-0010-000000000035', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000035', '80000000-0000-0000-0030-000000000035', '80000000-0000-0000-0002-000000000002', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000036', '80000000-0000-0000-0002-000000000003', '0fc63528-3464-37b2-8521-55b4869cd6ee', '80000000-0000-0000-0010-000000000036', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000036', '80000000-0000-0000-0030-000000000036', '80000000-0000-0000-0002-000000000003', '0fc63528-3464-37b2-8521-55b4869cd6ee', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000037', '80000000-0000-0000-0002-000000000004', '101f11a4-62d5-4242-255b-04e57ce36978', '80000000-0000-0000-0010-000000000037', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000037', '80000000-0000-0000-0030-000000000037', '80000000-0000-0000-0002-000000000004', '101f11a4-62d5-4242-255b-04e57ce36978', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000038', '80000000-0000-0000-0002-000000000001', '101f11a4-62d5-4242-255b-04e57ce36978', '80000000-0000-0000-0010-000000000038', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000038', '80000000-0000-0000-0030-000000000038', '80000000-0000-0000-0002-000000000001', '101f11a4-62d5-4242-255b-04e57ce36978', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000039', '80000000-0000-0000-0002-000000000002', '11720150-2ace-a89b-a007-105862080cc4', '80000000-0000-0000-0010-000000000039', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000039', '80000000-0000-0000-0030-000000000039', '80000000-0000-0000-0002-000000000002', '11720150-2ace-a89b-a007-105862080cc4', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003a', '80000000-0000-0000-0002-000000000003', '11720150-2ace-a89b-a007-105862080cc4', '80000000-0000-0000-0010-00000000003a', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003a', '80000000-0000-0000-0030-00000000003a', '80000000-0000-0000-0002-000000000003', '11720150-2ace-a89b-a007-105862080cc4', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003b', '80000000-0000-0000-0002-000000000004', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d', '80000000-0000-0000-0010-00000000003b', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003b', '80000000-0000-0000-0030-00000000003b', '80000000-0000-0000-0002-000000000004', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003c', '80000000-0000-0000-0002-000000000005', '12c784f2-ab72-014c-d70d-1893f093a555', '80000000-0000-0000-0010-00000000003c', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003c', '80000000-0000-0000-0030-00000000003c', '80000000-0000-0000-0002-000000000005', '12c784f2-ab72-014c-d70d-1893f093a555', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003d', '80000000-0000-0000-0002-000000000006', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '80000000-0000-0000-0010-00000000003d', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003d', '80000000-0000-0000-0030-00000000003d', '80000000-0000-0000-0002-000000000006', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003e', '80000000-0000-0000-0002-000000000007', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '80000000-0000-0000-0010-00000000003e', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003e', '80000000-0000-0000-0030-00000000003e', '80000000-0000-0000-0002-000000000007', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000003f', '80000000-0000-0000-0002-000000000008', '014624fb-6e10-8a38-b903-dcd2b742a8b1', '80000000-0000-0000-0010-00000000003f', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000003f', '80000000-0000-0000-0030-00000000003f', '80000000-0000-0000-0002-000000000008', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000040', '80000000-0000-0000-0002-000000000009', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', '80000000-0000-0000-0010-000000000040', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000040', '80000000-0000-0000-0030-000000000040', '80000000-0000-0000-0002-000000000009', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000041', '80000000-0000-0000-0002-00000000000a', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '80000000-0000-0000-0010-000000000041', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000041', '80000000-0000-0000-0030-000000000041', '80000000-0000-0000-0002-00000000000a', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000042', '80000000-0000-0000-0002-00000000000b', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '80000000-0000-0000-0010-000000000042', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000042', '80000000-0000-0000-0030-000000000042', '80000000-0000-0000-0002-00000000000b', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000043', '80000000-0000-0000-0002-00000000000c', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '80000000-0000-0000-0010-000000000043', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000043', '80000000-0000-0000-0030-000000000043', '80000000-0000-0000-0002-00000000000c', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000044', '80000000-0000-0000-0002-00000000000d', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '80000000-0000-0000-0010-000000000044', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000044', '80000000-0000-0000-0030-000000000044', '80000000-0000-0000-0002-00000000000d', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000045', '80000000-0000-0000-0002-00000000000e', '0467b23c-312e-25b9-af98-761fd1fffa9f', '80000000-0000-0000-0010-000000000045', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000045', '80000000-0000-0000-0030-000000000045', '80000000-0000-0000-0002-00000000000e', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000046', '80000000-0000-0000-0002-00000000000f', '0467b23c-312e-25b9-af98-761fd1fffa9f', '80000000-0000-0000-0010-000000000046', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000046', '80000000-0000-0000-0030-000000000046', '80000000-0000-0000-0002-00000000000f', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000047', '90000000-0000-0000-0000-000000000004', '05152036-18cd-98a6-92a3-cfc64f6651dd', '80000000-0000-0000-0010-000000000047', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000047', '80000000-0000-0000-0030-000000000047', '90000000-0000-0000-0000-000000000004', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000048', '90000000-0000-0000-0000-000000000013', '05152036-18cd-98a6-92a3-cfc64f6651dd', '80000000-0000-0000-0010-000000000048', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000048', '80000000-0000-0000-0030-000000000048', '90000000-0000-0000-0000-000000000013', '05152036-18cd-98a6-92a3-cfc64f6651dd', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000049', '90000000-0000-0000-0000-000000000014', '0585c0d7-3646-f502-d80a-0adcb2b184f1', '80000000-0000-0000-0010-000000000049', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000049', '80000000-0000-0000-0030-000000000049', '90000000-0000-0000-0000-000000000014', '0585c0d7-3646-f502-d80a-0adcb2b184f1', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004a', '90000000-0000-0000-0000-000000000201', '05866f27-98b4-7fd9-4e46-2f281ede4098', '80000000-0000-0000-0010-00000000004a', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004a', '80000000-0000-0000-0030-00000000004a', '90000000-0000-0000-0000-000000000201', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004b', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098', '80000000-0000-0000-0010-00000000004b', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004b', '80000000-0000-0000-0030-00000000004b', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004c', '90000000-0000-0000-0000-000000000203', '0603349d-dfde-11a2-1033-50c3aa512b02', '80000000-0000-0000-0010-00000000004c', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004c', '80000000-0000-0000-0030-00000000004c', '90000000-0000-0000-0000-000000000203', '0603349d-dfde-11a2-1033-50c3aa512b02', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004d', '90000000-0000-0000-0000-000000000204', '0603349d-dfde-11a2-1033-50c3aa512b02', '80000000-0000-0000-0010-00000000004d', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004d', '80000000-0000-0000-0030-00000000004d', '90000000-0000-0000-0000-000000000204', '0603349d-dfde-11a2-1033-50c3aa512b02', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004e', '90000000-0000-0000-0000-000000000205', '06487368-ce38-e21c-36f9-3b0fa28de677', '80000000-0000-0000-0010-00000000004e', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004e', '80000000-0000-0000-0030-00000000004e', '90000000-0000-0000-0000-000000000205', '06487368-ce38-e21c-36f9-3b0fa28de677', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000004f', '90000000-0000-0000-0000-000000000022', '071d8e82-0c9e-6671-9dd8-196d1071f373', '80000000-0000-0000-0010-00000000004f', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000004f', '80000000-0000-0000-0030-00000000004f', '90000000-0000-0000-0000-000000000022', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000050', '90000000-0000-0000-0000-000000000206', '071d8e82-0c9e-6671-9dd8-196d1071f373', '80000000-0000-0000-0010-000000000050', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000050', '80000000-0000-0000-0030-000000000050', '90000000-0000-0000-0000-000000000206', '071d8e82-0c9e-6671-9dd8-196d1071f373', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000051', '90000000-0000-0000-0000-000000000207', '083646c4-c3fa-3013-da09-e13691801fc5', '80000000-0000-0000-0010-000000000051', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000051', '80000000-0000-0000-0030-000000000051', '90000000-0000-0000-0000-000000000207', '083646c4-c3fa-3013-da09-e13691801fc5', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000052', '90000000-0000-0000-0000-000000000208', '083646c4-c3fa-3013-da09-e13691801fc5', '80000000-0000-0000-0010-000000000052', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000052', '80000000-0000-0000-0030-000000000052', '90000000-0000-0000-0000-000000000208', '083646c4-c3fa-3013-da09-e13691801fc5', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000053', '90000000-0000-0000-0000-000000000209', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '80000000-0000-0000-0010-000000000053', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000053', '80000000-0000-0000-0030-000000000053', '90000000-0000-0000-0000-000000000209', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000054', '90000000-0000-0000-0000-00000000020a', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', '80000000-0000-0000-0010-000000000054', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000054', '80000000-0000-0000-0030-000000000054', '90000000-0000-0000-0000-00000000020a', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000055', '90000000-0000-0000-0000-00000000020b', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '80000000-0000-0000-0010-000000000055', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000055', '80000000-0000-0000-0030-000000000055', '90000000-0000-0000-0000-00000000020b', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000056', '90000000-0000-0000-0000-00000000020c', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', '80000000-0000-0000-0010-000000000056', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000056', '80000000-0000-0000-0030-000000000056', '90000000-0000-0000-0000-00000000020c', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000057', '80000000-0000-0000-0002-000000000001', '0a29aded-3774-021a-2b95-bb726ec11274', '80000000-0000-0000-0010-000000000057', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000057', '80000000-0000-0000-0030-000000000057', '80000000-0000-0000-0002-000000000001', '0a29aded-3774-021a-2b95-bb726ec11274', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000058', '80000000-0000-0000-0002-000000000002', '0a8552db-6c07-6e3c-3930-4ef03b19008c', '80000000-0000-0000-0010-000000000058', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000058', '80000000-0000-0000-0030-000000000058', '80000000-0000-0000-0002-000000000002', '0a8552db-6c07-6e3c-3930-4ef03b19008c', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000059', '80000000-0000-0000-0002-000000000003', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', '80000000-0000-0000-0010-000000000059', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000059', '80000000-0000-0000-0030-000000000059', '80000000-0000-0000-0002-000000000003', '0bbcf01f-2a31-3bdc-fea2-662af666bf12', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005a', '80000000-0000-0000-0002-000000000004', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '80000000-0000-0000-0010-00000000005a', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005a', '80000000-0000-0000-0030-00000000005a', '80000000-0000-0000-0002-000000000004', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005b', '80000000-0000-0000-0002-000000000001', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', '80000000-0000-0000-0010-00000000005b', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005b', '80000000-0000-0000-0030-00000000005b', '80000000-0000-0000-0002-000000000001', '0be019cb-8f10-47d4-94f1-3fd82f1d8218', 'Sinh hóa máu (Ure, Creatinine, Điện giải đồ) & Đo điện tâm đồ ECG',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán I10.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005c', '80000000-0000-0000-0002-000000000002', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', '80000000-0000-0000-0010-00000000005c', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005c', '80000000-0000-0000-0030-00000000005c', '80000000-0000-0000-0002-000000000002', '0bf4f049-ca5a-190c-78da-e9ed7434b87c', 'Đo nồng độ Glucose máu đói & Định lượng HbA1c',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E11.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005d', '80000000-0000-0000-0002-000000000003', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', '80000000-0000-0000-0010-00000000005d', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005d', '80000000-0000-0000-0030-00000000005d', '80000000-0000-0000-0002-000000000003', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'Nội soi thực quản - dạ dày - tá tràng ống mềm & Test Hp',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán K21.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005e', '80000000-0000-0000-0002-000000000004', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', '80000000-0000-0000-0010-00000000005e', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005e', '80000000-0000-0000-0030-00000000005e', '80000000-0000-0000-0002-000000000004', '0d05ea81-c3a8-00bd-3c2b-1306065fafea', 'Chụp X-quang khớp gối thẳng nghiêng hai bên & Siêu âm khớp gối',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán M17.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-00000000005f', '80000000-0000-0000-0002-000000000005', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '80000000-0000-0000-0010-00000000005f', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-00000000005f', '80000000-0000-0000-0030-00000000005f', '80000000-0000-0000-0002-000000000005', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'Chụp cộng hưởng từ MRI sọ não mạch máu não không tiêm đối quang',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán G43.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000060', '80000000-0000-0000-0002-000000000006', '0d712f3a-15a3-beaa-1ce0-9570257c1470', '80000000-0000-0000-0010-000000000060', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000060', '80000000-0000-0000-0030-000000000060', '80000000-0000-0000-0002-000000000006', '0d712f3a-15a3-beaa-1ce0-9570257c1470', 'Siêu âm Doppler màu hệ động mạch cảnh - đốt sống',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán H81.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000061', '80000000-0000-0000-0002-000000000007', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '80000000-0000-0000-0010-000000000061', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000061', '80000000-0000-0000-0030-000000000061', '80000000-0000-0000-0002-000000000007', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'Đo chức năng hô hấp (Hô hấp ký có test giãn phế quản)',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J45.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000062', '80000000-0000-0000-0002-000000000008', '0d84db0c-2936-5cbd-63d2-d808f1063a18', '80000000-0000-0000-0010-000000000062', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000062', '80000000-0000-0000-0030-000000000062', '80000000-0000-0000-0002-000000000008', '0d84db0c-2936-5cbd-63d2-d808f1063a18', 'Nội soi Tai Mũi Họng ống mềm & Tổng phân tích tế bào máu ngoại vi',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán J06.9.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000063', '80000000-0000-0000-0002-000000000009', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', '80000000-0000-0000-0010-000000000063', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000063', '80000000-0000-0000-0030-000000000063', '80000000-0000-0000-0002-000000000009', '0de3f854-5cbd-1e8e-3005-437d39c81cf2', 'Siêu âm tuyến giáp Doppler màu & Định lượng TSH, FT3, FT4',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán E04.1.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_orders (
    id, patient_id, doctor_id, appointment_id, test_name,
    notes, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0030-000000000064', '80000000-0000-0000-0002-00000000000a', '0e333dc3-4388-6ae4-c059-f750302b16e0', '80000000-0000-0000-0010-000000000064', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Chỉ định kiểm tra cận lâm sàng phục vụ chẩn đoán xác định', 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO diagnostic_results (
    id, order_id, patient_id, doctor_id, test_name,
    result, file_url, test_date
  ) VALUES (
    '80000000-0000-0000-0035-000000000064', '80000000-0000-0000-0030-000000000064', '80000000-0000-0000-0002-00000000000a', '0e333dc3-4388-6ae4-c059-f750302b16e0', 'Siêu âm hệ tiết niệu & Chụp X-quang hệ tiết niệu KUB',
    'Kết quả xét nghiệm và chẩn đoán hình ảnh: các chỉ số trong giới hạn theo dõi lâm sàng, phù hợp chẩn đoán N20.0.',
    '/media/articles/5-dau-hieu-tim-mach.jpg', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;


-- 6. Prescriptions & Prescription Items (100 rx, 200 items)

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000001', '80000000-0000-0000-0020-000000000001', 'RX-2026-00100', '90000000-0000-0000-0000-000000000004', '00a2de74-0b8d-c45f-43f7-61f3d1f99612',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000001', '80000000-0000-0000-0040-000000000001', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('80000000-0000-0000-0045-000000000002', '80000000-0000-0000-0040-000000000001', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000002', '80000000-0000-0000-0020-000000000002', 'RX-2026-00101', '90000000-0000-0000-0000-000000000013', '00a2de74-0b8d-c45f-43f7-61f3d1f99612',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000003', '80000000-0000-0000-0040-000000000002', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('80000000-0000-0000-0045-000000000004', '80000000-0000-0000-0040-000000000002', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000003', '80000000-0000-0000-0020-000000000003', 'RX-2026-00102', '90000000-0000-0000-0000-000000000014', '014624fb-6e10-8a38-b903-dcd2b742a8b1',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000005', '80000000-0000-0000-0040-000000000003', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('80000000-0000-0000-0045-000000000006', '80000000-0000-0000-0040-000000000003', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000004', '80000000-0000-0000-0020-000000000004', 'RX-2026-00103', '90000000-0000-0000-0000-000000000201', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000007', '80000000-0000-0000-0040-000000000004', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('80000000-0000-0000-0045-000000000008', '80000000-0000-0000-0040-000000000004', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000005', '80000000-0000-0000-0020-000000000005', 'RX-2026-00104', '90000000-0000-0000-0000-000000000202', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000009', '80000000-0000-0000-0040-000000000005', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('80000000-0000-0000-0045-00000000000a', '80000000-0000-0000-0040-000000000005', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000006', '80000000-0000-0000-0020-000000000006', 'RX-2026-00105', '90000000-0000-0000-0000-000000000203', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000000b', '80000000-0000-0000-0040-000000000006', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('80000000-0000-0000-0045-00000000000c', '80000000-0000-0000-0040-000000000006', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000007', '80000000-0000-0000-0020-000000000007', 'RX-2026-00106', '90000000-0000-0000-0000-000000000204', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000000d', '80000000-0000-0000-0040-000000000007', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('80000000-0000-0000-0045-00000000000e', '80000000-0000-0000-0040-000000000007', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000008', '80000000-0000-0000-0020-000000000008', 'RX-2026-00107', '90000000-0000-0000-0000-000000000205', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000000f', '80000000-0000-0000-0040-000000000008', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('80000000-0000-0000-0045-000000000010', '80000000-0000-0000-0040-000000000008', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000009', '80000000-0000-0000-0020-000000000009', 'RX-2026-00108', '90000000-0000-0000-0000-000000000022', '0467b23c-312e-25b9-af98-761fd1fffa9f',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000011', '80000000-0000-0000-0040-000000000009', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '6 days'),
    ('80000000-0000-0000-0045-000000000012', '80000000-0000-0000-0040-000000000009', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000a', '80000000-0000-0000-0020-00000000000a', 'RX-2026-00109', '90000000-0000-0000-0000-000000000206', '0467b23c-312e-25b9-af98-761fd1fffa9f',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000013', '80000000-0000-0000-0040-00000000000a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '6 days'),
    ('80000000-0000-0000-0045-000000000014', '80000000-0000-0000-0040-00000000000a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000b', '80000000-0000-0000-0020-00000000000b', 'RX-2026-00110', '90000000-0000-0000-0000-000000000207', '05152036-18cd-98a6-92a3-cfc64f6651dd',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000015', '80000000-0000-0000-0040-00000000000b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('80000000-0000-0000-0045-000000000016', '80000000-0000-0000-0040-00000000000b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000c', '80000000-0000-0000-0020-00000000000c', 'RX-2026-00111', '90000000-0000-0000-0000-000000000208', '05152036-18cd-98a6-92a3-cfc64f6651dd',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000017', '80000000-0000-0000-0040-00000000000c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('80000000-0000-0000-0045-000000000018', '80000000-0000-0000-0040-00000000000c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000d', '80000000-0000-0000-0020-00000000000d', 'RX-2026-00112', '90000000-0000-0000-0000-000000000209', '0585c0d7-3646-f502-d80a-0adcb2b184f1',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000019', '80000000-0000-0000-0040-00000000000d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '8 days'),
    ('80000000-0000-0000-0045-00000000001a', '80000000-0000-0000-0040-00000000000d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000e', '80000000-0000-0000-0020-00000000000e', 'RX-2026-00113', '90000000-0000-0000-0000-00000000020a', '05866f27-98b4-7fd9-4e46-2f281ede4098',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000001b', '80000000-0000-0000-0040-00000000000e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '8 days'),
    ('80000000-0000-0000-0045-00000000001c', '80000000-0000-0000-0040-00000000000e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000000f', '80000000-0000-0000-0020-00000000000f', 'RX-2026-00114', '90000000-0000-0000-0000-00000000020b', '05866f27-98b4-7fd9-4e46-2f281ede4098',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000001d', '80000000-0000-0000-0040-00000000000f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '9 days'),
    ('80000000-0000-0000-0045-00000000001e', '80000000-0000-0000-0040-00000000000f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000010', '80000000-0000-0000-0020-000000000010', 'RX-2026-00115', '90000000-0000-0000-0000-00000000020c', '0603349d-dfde-11a2-1033-50c3aa512b02',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000001f', '80000000-0000-0000-0040-000000000010', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '9 days'),
    ('80000000-0000-0000-0045-000000000020', '80000000-0000-0000-0040-000000000010', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000011', '80000000-0000-0000-0020-000000000011', 'RX-2026-00116', '80000000-0000-0000-0002-000000000001', '0603349d-dfde-11a2-1033-50c3aa512b02',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000021', '80000000-0000-0000-0040-000000000011', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('80000000-0000-0000-0045-000000000022', '80000000-0000-0000-0040-000000000011', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000012', '80000000-0000-0000-0020-000000000012', 'RX-2026-00117', '80000000-0000-0000-0002-000000000002', '06487368-ce38-e21c-36f9-3b0fa28de677',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000023', '80000000-0000-0000-0040-000000000012', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '10 days'),
    ('80000000-0000-0000-0045-000000000024', '80000000-0000-0000-0040-000000000012', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000013', '80000000-0000-0000-0020-000000000013', 'RX-2026-00118', '80000000-0000-0000-0002-000000000003', '071d8e82-0c9e-6671-9dd8-196d1071f373',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000025', '80000000-0000-0000-0040-000000000013', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '11 days'),
    ('80000000-0000-0000-0045-000000000026', '80000000-0000-0000-0040-000000000013', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000014', '80000000-0000-0000-0020-000000000014', 'RX-2026-00119', '80000000-0000-0000-0002-000000000004', '071d8e82-0c9e-6671-9dd8-196d1071f373',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000027', '80000000-0000-0000-0040-000000000014', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '11 days'),
    ('80000000-0000-0000-0045-000000000028', '80000000-0000-0000-0040-000000000014', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000015', '80000000-0000-0000-0020-000000000015', 'RX-2026-00120', '80000000-0000-0000-0002-000000000001', '083646c4-c3fa-3013-da09-e13691801fc5',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000029', '80000000-0000-0000-0040-000000000015', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '12 days'),
    ('80000000-0000-0000-0045-00000000002a', '80000000-0000-0000-0040-000000000015', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000016', '80000000-0000-0000-0020-000000000016', 'RX-2026-00121', '80000000-0000-0000-0002-000000000002', '083646c4-c3fa-3013-da09-e13691801fc5',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000002b', '80000000-0000-0000-0040-000000000016', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '12 days'),
    ('80000000-0000-0000-0045-00000000002c', '80000000-0000-0000-0040-000000000016', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000017', '80000000-0000-0000-0020-000000000017', 'RX-2026-00122', '80000000-0000-0000-0002-000000000003', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000002d', '80000000-0000-0000-0040-000000000017', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '13 days'),
    ('80000000-0000-0000-0045-00000000002e', '80000000-0000-0000-0040-000000000017', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000018', '80000000-0000-0000-0020-000000000018', 'RX-2026-00123', '80000000-0000-0000-0002-000000000004', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000002f', '80000000-0000-0000-0040-000000000018', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '13 days'),
    ('80000000-0000-0000-0045-000000000030', '80000000-0000-0000-0040-000000000018', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '13 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000019', '80000000-0000-0000-0020-000000000019', 'RX-2026-00124', '80000000-0000-0000-0002-000000000005', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000031', '80000000-0000-0000-0040-000000000019', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '14 days'),
    ('80000000-0000-0000-0045-000000000032', '80000000-0000-0000-0040-000000000019', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001a', '80000000-0000-0000-0020-00000000001a', 'RX-2026-00125', '80000000-0000-0000-0002-000000000006', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000033', '80000000-0000-0000-0040-00000000001a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '14 days'),
    ('80000000-0000-0000-0045-000000000034', '80000000-0000-0000-0040-00000000001a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001b', '80000000-0000-0000-0020-00000000001b', 'RX-2026-00126', '80000000-0000-0000-0002-000000000007', '0a29aded-3774-021a-2b95-bb726ec11274',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000035', '80000000-0000-0000-0040-00000000001b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
    ('80000000-0000-0000-0045-000000000036', '80000000-0000-0000-0040-00000000001b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001c', '80000000-0000-0000-0020-00000000001c', 'RX-2026-00127', '80000000-0000-0000-0002-000000000008', '0a8552db-6c07-6e3c-3930-4ef03b19008c',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000037', '80000000-0000-0000-0040-00000000001c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
    ('80000000-0000-0000-0045-000000000038', '80000000-0000-0000-0040-00000000001c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001d', '80000000-0000-0000-0020-00000000001d', 'RX-2026-00128', '80000000-0000-0000-0002-000000000009', '0bbcf01f-2a31-3bdc-fea2-662af666bf12',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000039', '80000000-0000-0000-0040-00000000001d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '16 days'),
    ('80000000-0000-0000-0045-00000000003a', '80000000-0000-0000-0040-00000000001d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '16 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001e', '80000000-0000-0000-0020-00000000001e', 'RX-2026-00129', '80000000-0000-0000-0002-00000000000a', '0be019cb-8f10-47d4-94f1-3fd82f1d8218',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000003b', '80000000-0000-0000-0040-00000000001e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '16 days'),
    ('80000000-0000-0000-0045-00000000003c', '80000000-0000-0000-0040-00000000001e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '16 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000001f', '80000000-0000-0000-0020-00000000001f', 'RX-2026-00130', '80000000-0000-0000-0002-00000000000b', '0be019cb-8f10-47d4-94f1-3fd82f1d8218',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000003d', '80000000-0000-0000-0040-00000000001f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '17 days'),
    ('80000000-0000-0000-0045-00000000003e', '80000000-0000-0000-0040-00000000001f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '17 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000020', '80000000-0000-0000-0020-000000000020', 'RX-2026-00131', '80000000-0000-0000-0002-00000000000c', '0bf4f049-ca5a-190c-78da-e9ed7434b87c',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP - INTERVAL '17 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000003f', '80000000-0000-0000-0040-000000000020', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '17 days'),
    ('80000000-0000-0000-0045-000000000040', '80000000-0000-0000-0040-000000000020', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '17 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000021', '80000000-0000-0000-0020-000000000021', 'RX-2026-00132', '80000000-0000-0000-0002-00000000000d', '0d05ea81-c3a8-00bd-3c2b-1306065fafea',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000041', '80000000-0000-0000-0040-000000000021', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '18 days'),
    ('80000000-0000-0000-0045-000000000042', '80000000-0000-0000-0040-000000000021', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '18 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000022', '80000000-0000-0000-0020-000000000022', 'RX-2026-00133', '80000000-0000-0000-0002-00000000000e', '0d05ea81-c3a8-00bd-3c2b-1306065fafea',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '18 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000043', '80000000-0000-0000-0040-000000000022', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '18 days'),
    ('80000000-0000-0000-0045-000000000044', '80000000-0000-0000-0040-000000000022', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '18 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000023', '80000000-0000-0000-0020-000000000023', 'RX-2026-00134', '80000000-0000-0000-0002-00000000000f', '0d712f3a-15a3-beaa-1ce0-9570257c1470',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000045', '80000000-0000-0000-0040-000000000023', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '19 days'),
    ('80000000-0000-0000-0045-000000000046', '80000000-0000-0000-0040-000000000023', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '19 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000024', '80000000-0000-0000-0020-000000000024', 'RX-2026-00135', '90000000-0000-0000-0000-000000000004', '0d712f3a-15a3-beaa-1ce0-9570257c1470',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '19 days', CURRENT_TIMESTAMP - INTERVAL '19 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000047', '80000000-0000-0000-0040-000000000024', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '19 days'),
    ('80000000-0000-0000-0045-000000000048', '80000000-0000-0000-0040-000000000024', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '19 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000025', '80000000-0000-0000-0020-000000000025', 'RX-2026-00136', '90000000-0000-0000-0000-000000000013', '0d84db0c-2936-5cbd-63d2-d808f1063a18',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000049', '80000000-0000-0000-0040-000000000025', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '20 days'),
    ('80000000-0000-0000-0045-00000000004a', '80000000-0000-0000-0040-000000000025', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000026', '80000000-0000-0000-0020-000000000026', 'RX-2026-00137', '90000000-0000-0000-0000-000000000014', '0d84db0c-2936-5cbd-63d2-d808f1063a18',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '20 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000004b', '80000000-0000-0000-0040-000000000026', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '20 days'),
    ('80000000-0000-0000-0045-00000000004c', '80000000-0000-0000-0040-000000000026', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000027', '80000000-0000-0000-0020-000000000027', 'RX-2026-00138', '90000000-0000-0000-0000-000000000201', '0de3f854-5cbd-1e8e-3005-437d39c81cf2',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000004d', '80000000-0000-0000-0040-000000000027', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '21 days'),
    ('80000000-0000-0000-0045-00000000004e', '80000000-0000-0000-0040-000000000027', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '21 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000028', '80000000-0000-0000-0020-000000000028', 'RX-2026-00139', '90000000-0000-0000-0000-000000000202', '0e333dc3-4388-6ae4-c059-f750302b16e0',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '21 days', CURRENT_TIMESTAMP - INTERVAL '21 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000004f', '80000000-0000-0000-0040-000000000028', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '21 days'),
    ('80000000-0000-0000-0045-000000000050', '80000000-0000-0000-0040-000000000028', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '21 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000029', '80000000-0000-0000-0020-000000000029', 'RX-2026-00140', '90000000-0000-0000-0000-000000000203', '0e51eada-c05e-4d5f-25e5-73aea8120dd3',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000051', '80000000-0000-0000-0040-000000000029', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '22 days'),
    ('80000000-0000-0000-0045-000000000052', '80000000-0000-0000-0040-000000000029', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '22 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002a', '80000000-0000-0000-0020-00000000002a', 'RX-2026-00141', '90000000-0000-0000-0000-000000000204', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '22 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000053', '80000000-0000-0000-0040-00000000002a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '22 days'),
    ('80000000-0000-0000-0045-000000000054', '80000000-0000-0000-0040-00000000002a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '22 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002b', '80000000-0000-0000-0020-00000000002b', 'RX-2026-00142', '90000000-0000-0000-0000-000000000205', '0e5db434-b8fa-a4e8-23b8-2a6e35381b3a',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000055', '80000000-0000-0000-0040-00000000002b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '23 days'),
    ('80000000-0000-0000-0045-000000000056', '80000000-0000-0000-0040-00000000002b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '23 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002c', '80000000-0000-0000-0020-00000000002c', 'RX-2026-00143', '90000000-0000-0000-0000-000000000022', '0e6cb13d-885f-c605-966a-13c0eaa951c1',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '23 days', CURRENT_TIMESTAMP - INTERVAL '23 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000057', '80000000-0000-0000-0040-00000000002c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '23 days'),
    ('80000000-0000-0000-0045-000000000058', '80000000-0000-0000-0040-00000000002c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '23 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002d', '80000000-0000-0000-0020-00000000002d', 'RX-2026-00144', '90000000-0000-0000-0000-000000000206', '0eba85fb-2c9d-c556-7aaf-6acfd33c8a95',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000059', '80000000-0000-0000-0040-00000000002d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '24 days'),
    ('80000000-0000-0000-0045-00000000005a', '80000000-0000-0000-0040-00000000002d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '24 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002e', '80000000-0000-0000-0020-00000000002e', 'RX-2026-00145', '90000000-0000-0000-0000-000000000207', '0f0245c2-fd64-efb4-5561-83404f179a22',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP - INTERVAL '24 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000005b', '80000000-0000-0000-0040-00000000002e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '24 days'),
    ('80000000-0000-0000-0045-00000000005c', '80000000-0000-0000-0040-00000000002e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '24 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000002f', '80000000-0000-0000-0020-00000000002f', 'RX-2026-00146', '90000000-0000-0000-0000-000000000208', '0f0245c2-fd64-efb4-5561-83404f179a22',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000005d', '80000000-0000-0000-0040-00000000002f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '25 days'),
    ('80000000-0000-0000-0045-00000000005e', '80000000-0000-0000-0040-00000000002f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000030', '80000000-0000-0000-0020-000000000030', 'RX-2026-00147', '90000000-0000-0000-0000-000000000209', '0f0c7281-cb72-35ac-d7ba-e9106a543aea',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '25 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000005f', '80000000-0000-0000-0040-000000000030', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '25 days'),
    ('80000000-0000-0000-0045-000000000060', '80000000-0000-0000-0040-000000000030', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000031', '80000000-0000-0000-0020-000000000031', 'RX-2026-00148', '90000000-0000-0000-0000-00000000020a', '0f0c7281-cb72-35ac-d7ba-e9106a543aea',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000061', '80000000-0000-0000-0040-000000000031', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '26 days'),
    ('80000000-0000-0000-0045-000000000062', '80000000-0000-0000-0040-000000000031', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '26 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000032', '80000000-0000-0000-0020-000000000032', 'RX-2026-00149', '90000000-0000-0000-0000-00000000020b', '0f1a8cb6-707d-03a0-1acb-83d8c61e2cb9',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '26 days', CURRENT_TIMESTAMP - INTERVAL '26 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000063', '80000000-0000-0000-0040-000000000032', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '26 days'),
    ('80000000-0000-0000-0045-000000000064', '80000000-0000-0000-0040-000000000032', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '26 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000033', '80000000-0000-0000-0020-000000000033', 'RX-2026-00150', '90000000-0000-0000-0000-00000000020c', '0f49100f-3940-a9a2-f9d9-792b4a265768',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000065', '80000000-0000-0000-0040-000000000033', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '27 days'),
    ('80000000-0000-0000-0045-000000000066', '80000000-0000-0000-0040-000000000033', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '27 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000034', '80000000-0000-0000-0020-000000000034', 'RX-2026-00151', '80000000-0000-0000-0002-000000000001', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '27 days', CURRENT_TIMESTAMP - INTERVAL '27 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000067', '80000000-0000-0000-0040-000000000034', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '27 days'),
    ('80000000-0000-0000-0045-000000000068', '80000000-0000-0000-0040-000000000034', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '27 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000035', '80000000-0000-0000-0020-000000000035', 'RX-2026-00152', '80000000-0000-0000-0002-000000000002', '0f7a70b6-dbc4-36e4-59b4-e1e98ecb36bc',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000069', '80000000-0000-0000-0040-000000000035', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '28 days'),
    ('80000000-0000-0000-0045-00000000006a', '80000000-0000-0000-0040-000000000035', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '28 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000036', '80000000-0000-0000-0020-000000000036', 'RX-2026-00153', '80000000-0000-0000-0002-000000000003', '0fc63528-3464-37b2-8521-55b4869cd6ee',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000006b', '80000000-0000-0000-0040-000000000036', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '28 days'),
    ('80000000-0000-0000-0045-00000000006c', '80000000-0000-0000-0040-000000000036', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '28 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000037', '80000000-0000-0000-0020-000000000037', 'RX-2026-00154', '80000000-0000-0000-0002-000000000004', '101f11a4-62d5-4242-255b-04e57ce36978',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000006d', '80000000-0000-0000-0040-000000000037', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '29 days'),
    ('80000000-0000-0000-0045-00000000006e', '80000000-0000-0000-0040-000000000037', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '29 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000038', '80000000-0000-0000-0020-000000000038', 'RX-2026-00155', '80000000-0000-0000-0002-000000000001', '101f11a4-62d5-4242-255b-04e57ce36978',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '29 days', CURRENT_TIMESTAMP - INTERVAL '29 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000006f', '80000000-0000-0000-0040-000000000038', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '29 days'),
    ('80000000-0000-0000-0045-000000000070', '80000000-0000-0000-0040-000000000038', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '29 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000039', '80000000-0000-0000-0020-000000000039', 'RX-2026-00156', '80000000-0000-0000-0002-000000000002', '11720150-2ace-a89b-a007-105862080cc4',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000071', '80000000-0000-0000-0040-000000000039', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '30 days'),
    ('80000000-0000-0000-0045-000000000072', '80000000-0000-0000-0040-000000000039', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '30 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003a', '80000000-0000-0000-0020-00000000003a', 'RX-2026-00157', '80000000-0000-0000-0002-000000000003', '11720150-2ace-a89b-a007-105862080cc4',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000073', '80000000-0000-0000-0040-00000000003a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '30 days'),
    ('80000000-0000-0000-0045-000000000074', '80000000-0000-0000-0040-00000000003a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '30 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003b', '80000000-0000-0000-0020-00000000003b', 'RX-2026-00158', '80000000-0000-0000-0002-000000000004', '11f7ef73-782f-7b86-7910-2e59c2e0bc5d',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000075', '80000000-0000-0000-0040-00000000003b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '31 days'),
    ('80000000-0000-0000-0045-000000000076', '80000000-0000-0000-0040-00000000003b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '31 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003c', '80000000-0000-0000-0020-00000000003c', 'RX-2026-00159', '80000000-0000-0000-0002-000000000005', '12c784f2-ab72-014c-d70d-1893f093a555',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '31 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000077', '80000000-0000-0000-0040-00000000003c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '31 days'),
    ('80000000-0000-0000-0045-000000000078', '80000000-0000-0000-0040-00000000003c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '31 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003d', '80000000-0000-0000-0020-00000000003d', 'RX-2026-00160', '80000000-0000-0000-0002-000000000006', '00a2de74-0b8d-c45f-43f7-61f3d1f99612',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000079', '80000000-0000-0000-0040-00000000003d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '32 days'),
    ('80000000-0000-0000-0045-00000000007a', '80000000-0000-0000-0040-00000000003d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '32 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003e', '80000000-0000-0000-0020-00000000003e', 'RX-2026-00161', '80000000-0000-0000-0002-000000000007', '00a2de74-0b8d-c45f-43f7-61f3d1f99612',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '32 days', CURRENT_TIMESTAMP - INTERVAL '32 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000007b', '80000000-0000-0000-0040-00000000003e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '32 days'),
    ('80000000-0000-0000-0045-00000000007c', '80000000-0000-0000-0040-00000000003e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '32 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000003f', '80000000-0000-0000-0020-00000000003f', 'RX-2026-00162', '80000000-0000-0000-0002-000000000008', '014624fb-6e10-8a38-b903-dcd2b742a8b1',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000007d', '80000000-0000-0000-0040-00000000003f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '33 days'),
    ('80000000-0000-0000-0045-00000000007e', '80000000-0000-0000-0040-00000000003f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '33 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000040', '80000000-0000-0000-0020-000000000040', 'RX-2026-00163', '80000000-0000-0000-0002-000000000009', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '33 days', CURRENT_TIMESTAMP - INTERVAL '33 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000007f', '80000000-0000-0000-0040-000000000040', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '33 days'),
    ('80000000-0000-0000-0045-000000000080', '80000000-0000-0000-0040-000000000040', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '33 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000041', '80000000-0000-0000-0020-000000000041', 'RX-2026-00164', '80000000-0000-0000-0002-00000000000a', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000081', '80000000-0000-0000-0040-000000000041', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '34 days'),
    ('80000000-0000-0000-0045-000000000082', '80000000-0000-0000-0040-000000000041', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '34 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000042', '80000000-0000-0000-0020-000000000042', 'RX-2026-00165', '80000000-0000-0000-0002-00000000000b', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '34 days', CURRENT_TIMESTAMP - INTERVAL '34 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000083', '80000000-0000-0000-0040-000000000042', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '34 days'),
    ('80000000-0000-0000-0045-000000000084', '80000000-0000-0000-0040-000000000042', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '34 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000043', '80000000-0000-0000-0020-000000000043', 'RX-2026-00166', '80000000-0000-0000-0002-00000000000c', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000085', '80000000-0000-0000-0040-000000000043', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '35 days'),
    ('80000000-0000-0000-0045-000000000086', '80000000-0000-0000-0040-000000000043', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '35 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000044', '80000000-0000-0000-0020-000000000044', 'RX-2026-00167', '80000000-0000-0000-0002-00000000000d', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '35 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000087', '80000000-0000-0000-0040-000000000044', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '35 days'),
    ('80000000-0000-0000-0045-000000000088', '80000000-0000-0000-0040-000000000044', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '35 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000045', '80000000-0000-0000-0020-000000000045', 'RX-2026-00168', '80000000-0000-0000-0002-00000000000e', '0467b23c-312e-25b9-af98-761fd1fffa9f',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000089', '80000000-0000-0000-0040-000000000045', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '36 days'),
    ('80000000-0000-0000-0045-00000000008a', '80000000-0000-0000-0040-000000000045', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '36 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000046', '80000000-0000-0000-0020-000000000046', 'RX-2026-00169', '80000000-0000-0000-0002-00000000000f', '0467b23c-312e-25b9-af98-761fd1fffa9f',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '36 days', CURRENT_TIMESTAMP - INTERVAL '36 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000008b', '80000000-0000-0000-0040-000000000046', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '36 days'),
    ('80000000-0000-0000-0045-00000000008c', '80000000-0000-0000-0040-000000000046', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '36 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000047', '80000000-0000-0000-0020-000000000047', 'RX-2026-00170', '90000000-0000-0000-0000-000000000004', '05152036-18cd-98a6-92a3-cfc64f6651dd',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000008d', '80000000-0000-0000-0040-000000000047', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '37 days'),
    ('80000000-0000-0000-0045-00000000008e', '80000000-0000-0000-0040-000000000047', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '37 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000048', '80000000-0000-0000-0020-000000000048', 'RX-2026-00171', '90000000-0000-0000-0000-000000000013', '05152036-18cd-98a6-92a3-cfc64f6651dd',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '37 days', CURRENT_TIMESTAMP - INTERVAL '37 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000008f', '80000000-0000-0000-0040-000000000048', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '37 days'),
    ('80000000-0000-0000-0045-000000000090', '80000000-0000-0000-0040-000000000048', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '37 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000049', '80000000-0000-0000-0020-000000000049', 'RX-2026-00172', '90000000-0000-0000-0000-000000000014', '0585c0d7-3646-f502-d80a-0adcb2b184f1',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000091', '80000000-0000-0000-0040-000000000049', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '38 days'),
    ('80000000-0000-0000-0045-000000000092', '80000000-0000-0000-0040-000000000049', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '38 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004a', '80000000-0000-0000-0020-00000000004a', 'RX-2026-00173', '90000000-0000-0000-0000-000000000201', '05866f27-98b4-7fd9-4e46-2f281ede4098',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '38 days', CURRENT_TIMESTAMP - INTERVAL '38 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000093', '80000000-0000-0000-0040-00000000004a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '38 days'),
    ('80000000-0000-0000-0045-000000000094', '80000000-0000-0000-0040-00000000004a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '38 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004b', '80000000-0000-0000-0020-00000000004b', 'RX-2026-00174', '90000000-0000-0000-0000-000000000202', '05866f27-98b4-7fd9-4e46-2f281ede4098',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000095', '80000000-0000-0000-0040-00000000004b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '39 days'),
    ('80000000-0000-0000-0045-000000000096', '80000000-0000-0000-0040-00000000004b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '39 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004c', '80000000-0000-0000-0020-00000000004c', 'RX-2026-00175', '90000000-0000-0000-0000-000000000203', '0603349d-dfde-11a2-1033-50c3aa512b02',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '39 days', CURRENT_TIMESTAMP - INTERVAL '39 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000097', '80000000-0000-0000-0040-00000000004c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '39 days'),
    ('80000000-0000-0000-0045-000000000098', '80000000-0000-0000-0040-00000000004c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '39 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004d', '80000000-0000-0000-0020-00000000004d', 'RX-2026-00176', '90000000-0000-0000-0000-000000000204', '0603349d-dfde-11a2-1033-50c3aa512b02',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-000000000099', '80000000-0000-0000-0040-00000000004d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '40 days'),
    ('80000000-0000-0000-0045-00000000009a', '80000000-0000-0000-0040-00000000004d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '40 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004e', '80000000-0000-0000-0020-00000000004e', 'RX-2026-00177', '90000000-0000-0000-0000-000000000205', '06487368-ce38-e21c-36f9-3b0fa28de677',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP - INTERVAL '40 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000009b', '80000000-0000-0000-0040-00000000004e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '40 days'),
    ('80000000-0000-0000-0045-00000000009c', '80000000-0000-0000-0040-00000000004e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '40 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000004f', '80000000-0000-0000-0020-00000000004f', 'RX-2026-00178', '90000000-0000-0000-0000-000000000022', '071d8e82-0c9e-6671-9dd8-196d1071f373',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000009d', '80000000-0000-0000-0040-00000000004f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '41 days'),
    ('80000000-0000-0000-0045-00000000009e', '80000000-0000-0000-0040-00000000004f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '41 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000050', '80000000-0000-0000-0020-000000000050', 'RX-2026-00179', '90000000-0000-0000-0000-000000000206', '071d8e82-0c9e-6671-9dd8-196d1071f373',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '41 days', CURRENT_TIMESTAMP - INTERVAL '41 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-00000000009f', '80000000-0000-0000-0040-000000000050', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '41 days'),
    ('80000000-0000-0000-0045-0000000000a0', '80000000-0000-0000-0040-000000000050', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '41 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000051', '80000000-0000-0000-0020-000000000051', 'RX-2026-00180', '90000000-0000-0000-0000-000000000207', '083646c4-c3fa-3013-da09-e13691801fc5',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000a1', '80000000-0000-0000-0040-000000000051', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '42 days'),
    ('80000000-0000-0000-0045-0000000000a2', '80000000-0000-0000-0040-000000000051', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '42 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000052', '80000000-0000-0000-0020-000000000052', 'RX-2026-00181', '90000000-0000-0000-0000-000000000208', '083646c4-c3fa-3013-da09-e13691801fc5',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '42 days', CURRENT_TIMESTAMP - INTERVAL '42 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000a3', '80000000-0000-0000-0040-000000000052', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '42 days'),
    ('80000000-0000-0000-0045-0000000000a4', '80000000-0000-0000-0040-000000000052', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '42 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000053', '80000000-0000-0000-0020-000000000053', 'RX-2026-00182', '90000000-0000-0000-0000-000000000209', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000a5', '80000000-0000-0000-0040-000000000053', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '43 days'),
    ('80000000-0000-0000-0045-0000000000a6', '80000000-0000-0000-0040-000000000053', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '43 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000054', '80000000-0000-0000-0020-000000000054', 'RX-2026-00183', '90000000-0000-0000-0000-00000000020a', '096a389e-4cf8-5bff-ce07-1f1f1c988ba8',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '43 days', CURRENT_TIMESTAMP - INTERVAL '43 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000a7', '80000000-0000-0000-0040-000000000054', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '43 days'),
    ('80000000-0000-0000-0045-0000000000a8', '80000000-0000-0000-0040-000000000054', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '43 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000055', '80000000-0000-0000-0020-000000000055', 'RX-2026-00184', '90000000-0000-0000-0000-00000000020b', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000a9', '80000000-0000-0000-0040-000000000055', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '44 days'),
    ('80000000-0000-0000-0045-0000000000aa', '80000000-0000-0000-0040-000000000055', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '44 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000056', '80000000-0000-0000-0020-000000000056', 'RX-2026-00185', '90000000-0000-0000-0000-00000000020c', '09abbf2a-d771-8d5f-7ba2-4ab8dcfca55b',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '44 days', CURRENT_TIMESTAMP - INTERVAL '44 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000ab', '80000000-0000-0000-0040-000000000056', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '44 days'),
    ('80000000-0000-0000-0045-0000000000ac', '80000000-0000-0000-0040-000000000056', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '44 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000057', '80000000-0000-0000-0020-000000000057', 'RX-2026-00186', '80000000-0000-0000-0002-000000000001', '0a29aded-3774-021a-2b95-bb726ec11274',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000ad', '80000000-0000-0000-0040-000000000057', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '45 days'),
    ('80000000-0000-0000-0045-0000000000ae', '80000000-0000-0000-0040-000000000057', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '45 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000058', '80000000-0000-0000-0020-000000000058', 'RX-2026-00187', '80000000-0000-0000-0002-000000000002', '0a8552db-6c07-6e3c-3930-4ef03b19008c',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP - INTERVAL '45 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000af', '80000000-0000-0000-0040-000000000058', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '45 days'),
    ('80000000-0000-0000-0045-0000000000b0', '80000000-0000-0000-0040-000000000058', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '45 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000059', '80000000-0000-0000-0020-000000000059', 'RX-2026-00188', '80000000-0000-0000-0002-000000000003', '0bbcf01f-2a31-3bdc-fea2-662af666bf12',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000b1', '80000000-0000-0000-0040-000000000059', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '46 days'),
    ('80000000-0000-0000-0045-0000000000b2', '80000000-0000-0000-0040-000000000059', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '46 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005a', '80000000-0000-0000-0020-00000000005a', 'RX-2026-00189', '80000000-0000-0000-0002-000000000004', '0be019cb-8f10-47d4-94f1-3fd82f1d8218',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '46 days', CURRENT_TIMESTAMP - INTERVAL '46 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000b3', '80000000-0000-0000-0040-00000000005a', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '46 days'),
    ('80000000-0000-0000-0045-0000000000b4', '80000000-0000-0000-0040-00000000005a', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '46 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005b', '80000000-0000-0000-0020-00000000005b', 'RX-2026-00190', '80000000-0000-0000-0002-000000000001', '0be019cb-8f10-47d4-94f1-3fd82f1d8218',
    'I10 - Tăng huyết áp vô căn (nguyên phát)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000b5', '80000000-0000-0000-0040-00000000005b', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '47 days'),
    ('80000000-0000-0000-0045-0000000000b6', '80000000-0000-0000-0040-00000000005b', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '47 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005c', '80000000-0000-0000-0020-00000000005c', 'RX-2026-00191', '80000000-0000-0000-0002-000000000002', '0bf4f049-ca5a-190c-78da-e9ed7434b87c',
    'E11.9 - Đái tháo đường typ 2 không có biến chứng',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '47 days', CURRENT_TIMESTAMP - INTERVAL '47 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000b7', '80000000-0000-0000-0040-00000000005c', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '47 days'),
    ('80000000-0000-0000-0045-0000000000b8', '80000000-0000-0000-0040-00000000005c', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '47 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005d', '80000000-0000-0000-0020-00000000005d', 'RX-2026-00192', '80000000-0000-0000-0002-000000000003', '0d05ea81-c3a8-00bd-3c2b-1306065fafea',
    'K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000b9', '80000000-0000-0000-0040-00000000005d', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '48 days'),
    ('80000000-0000-0000-0045-0000000000ba', '80000000-0000-0000-0040-00000000005d', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '48 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005e', '80000000-0000-0000-0020-00000000005e', 'RX-2026-00193', '80000000-0000-0000-0002-000000000004', '0d05ea81-c3a8-00bd-3c2b-1306065fafea',
    'M17.0 - Thoái hóa khớp gối nguyên phát hai bên',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '48 days', CURRENT_TIMESTAMP - INTERVAL '48 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000bb', '80000000-0000-0000-0040-00000000005e', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '48 days'),
    ('80000000-0000-0000-0045-0000000000bc', '80000000-0000-0000-0040-00000000005e', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '48 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-00000000005f', '80000000-0000-0000-0020-00000000005f', 'RX-2026-00194', '80000000-0000-0000-0002-000000000005', '0d712f3a-15a3-beaa-1ce0-9570257c1470',
    'G43.9 - Đau nửa đầu Migraine không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000bd', '80000000-0000-0000-0040-00000000005f', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '49 days'),
    ('80000000-0000-0000-0045-0000000000be', '80000000-0000-0000-0040-00000000005f', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '49 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000060', '80000000-0000-0000-0020-000000000060', 'RX-2026-00195', '80000000-0000-0000-0002-000000000006', '0d712f3a-15a3-beaa-1ce0-9570257c1470',
    'H81.0 - Rối loạn tiền đình (bệnh Ménière)',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '49 days', CURRENT_TIMESTAMP - INTERVAL '49 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000bf', '80000000-0000-0000-0040-000000000060', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '49 days'),
    ('80000000-0000-0000-0045-0000000000c0', '80000000-0000-0000-0040-000000000060', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '49 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000061', '80000000-0000-0000-0020-000000000061', 'RX-2026-00196', '80000000-0000-0000-0002-000000000007', '0d84db0c-2936-5cbd-63d2-d808f1063a18',
    'J45.9 - Hen phế quản không đặc hiệu',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000c1', '80000000-0000-0000-0040-000000000061', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '50 days'),
    ('80000000-0000-0000-0045-0000000000c2', '80000000-0000-0000-0040-000000000061', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '50 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000062', '80000000-0000-0000-0020-000000000062', 'RX-2026-00197', '80000000-0000-0000-0002-000000000008', '0d84db0c-2936-5cbd-63d2-d808f1063a18',
    'J06.9 - Nhiễm khuẩn hô hấp trên cấp tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '50 days', CURRENT_TIMESTAMP - INTERVAL '50 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000c3', '80000000-0000-0000-0040-000000000062', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '50 days'),
    ('80000000-0000-0000-0045-0000000000c4', '80000000-0000-0000-0040-000000000062', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '50 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000063', '80000000-0000-0000-0020-000000000063', 'RX-2026-00198', '80000000-0000-0000-0002-000000000009', '0de3f854-5cbd-1e8e-3005-437d39c81cf2',
    'E04.1 - Bướu nhân tuyến giáp đơn độc lành tính',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000c5', '80000000-0000-0000-0040-000000000063', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '51 days'),
    ('80000000-0000-0000-0045-0000000000c6', '80000000-0000-0000-0040-000000000063', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '51 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescriptions (
    id, medical_record_id, prescription_code, patient_id, doctor_id,
    diagnosis_summary, general_advice, status, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0040-000000000064', '80000000-0000-0000-0020-000000000064', 'RX-2026-00199', '80000000-0000-0000-0002-00000000000a', '0e333dc3-4388-6ae4-c059-f750302b16e0',
    'N20.0 - Sỏi thận và sỏi niệu quản',
    'Uống thuốc đúng giờ sau bữa ăn. Giảm ăn mặn, kiêng rượu bia. Uống đủ 2 lít nước mỗi ngày.',
    'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '51 days', CURRENT_TIMESTAMP - INTERVAL '51 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO prescription_items (
    id, prescription_id, medication_name, active_ingredient, dosage,
    unit, frequency, duration_days, total_quantity, usage_note, created_at
  ) VALUES
    ('80000000-0000-0000-0045-0000000000c7', '80000000-0000-0000-0040-000000000064', 'Amlodipine Stella 5mg', 'Amlodipine besylate', '5mg', 'viên', '1 lần/ngày', 30, 30, 'Uống 1 viên vào mỗi buổi sáng sau khi ăn.', CURRENT_TIMESTAMP - INTERVAL '51 days'),
    ('80000000-0000-0000-0045-0000000000c8', '80000000-0000-0000-0040-000000000064', 'Panadol Extra 500mg', 'Paracetamol / Caffeine', '500mg/65mg', 'viên', 'Khi đau', 10, 10, 'Uống 1 viên khi có cơn đau hoặc sốt trên 38.5 độ.', CURRENT_TIMESTAMP - INTERVAL '51 days')
  ON CONFLICT (id) DO NOTHING;


-- 7. Patient Care Plans & Items (30 plans, 60 items)

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000001', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Tăng huyết áp vô căn (nguyên phát) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000001', '80000000-0000-0000-0050-000000000001', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000002', '80000000-0000-0000-0050-000000000001', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000002', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đái tháo đường typ 2 không có biến chứng (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000003', '80000000-0000-0000-0050-000000000002', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000004', '80000000-0000-0000-0050-000000000002', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000003', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bệnh trào ngược dạ dày - thực quản có viêm thực quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000005', '80000000-0000-0000-0050-000000000003', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000006', '80000000-0000-0000-0050-000000000003', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000004', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Thoái hóa khớp gối nguyên phát hai bên (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000007', '80000000-0000-0000-0050-000000000004', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000008', '80000000-0000-0000-0050-000000000004', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000005', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đau nửa đầu Migraine không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000009', '80000000-0000-0000-0050-000000000005', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000a', '80000000-0000-0000-0050-000000000005', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000006', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Rối loạn tiền đình (bệnh Ménière) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000b', '80000000-0000-0000-0050-000000000006', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000c', '80000000-0000-0000-0050-000000000006', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000007', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Hen phế quản không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000d', '80000000-0000-0000-0050-000000000007', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000e', '80000000-0000-0000-0050-000000000007', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000008', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Nhiễm khuẩn hô hấp trên cấp tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000000f', '80000000-0000-0000-0050-000000000008', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000010', '80000000-0000-0000-0050-000000000008', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000009', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bướu nhân tuyến giáp đơn độc lành tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000011', '80000000-0000-0000-0050-000000000009', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000012', '80000000-0000-0000-0050-000000000009', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000a', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Sỏi thận và sỏi niệu quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000013', '80000000-0000-0000-0050-00000000000a', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000014', '80000000-0000-0000-0050-00000000000a', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000b', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Tăng huyết áp vô căn (nguyên phát) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000015', '80000000-0000-0000-0050-00000000000b', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000016', '80000000-0000-0000-0050-00000000000b', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000c', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đái tháo đường typ 2 không có biến chứng (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000017', '80000000-0000-0000-0050-00000000000c', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000018', '80000000-0000-0000-0050-00000000000c', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000d', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bệnh trào ngược dạ dày - thực quản có viêm thực quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000019', '80000000-0000-0000-0050-00000000000d', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001a', '80000000-0000-0000-0050-00000000000d', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000e', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Thoái hóa khớp gối nguyên phát hai bên (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001b', '80000000-0000-0000-0050-00000000000e', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001c', '80000000-0000-0000-0050-00000000000e', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000000f', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đau nửa đầu Migraine không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001d', '80000000-0000-0000-0050-00000000000f', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001e', '80000000-0000-0000-0050-00000000000f', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000010', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Rối loạn tiền đình (bệnh Ménière) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000001f', '80000000-0000-0000-0050-000000000010', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000020', '80000000-0000-0000-0050-000000000010', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000011', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Hen phế quản không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000021', '80000000-0000-0000-0050-000000000011', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000022', '80000000-0000-0000-0050-000000000011', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000012', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Nhiễm khuẩn hô hấp trên cấp tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000023', '80000000-0000-0000-0050-000000000012', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000024', '80000000-0000-0000-0050-000000000012', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000013', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bướu nhân tuyến giáp đơn độc lành tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000025', '80000000-0000-0000-0050-000000000013', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000026', '80000000-0000-0000-0050-000000000013', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000014', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Sỏi thận và sỏi niệu quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000027', '80000000-0000-0000-0050-000000000014', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000028', '80000000-0000-0000-0050-000000000014', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000015', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Tăng huyết áp vô căn (nguyên phát) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000015'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000029', '80000000-0000-0000-0050-000000000015', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000015'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002a', '80000000-0000-0000-0050-000000000015', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000015'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000016', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đái tháo đường typ 2 không có biến chứng (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000016'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002b', '80000000-0000-0000-0050-000000000016', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000016'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002c', '80000000-0000-0000-0050-000000000016', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '12 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000016'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000017', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bệnh trào ngược dạ dày - thực quản có viêm thực quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000017'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002d', '80000000-0000-0000-0050-000000000017', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000017'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002e', '80000000-0000-0000-0050-000000000017', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000017'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000018', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Thoái hóa khớp gối nguyên phát hai bên (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000018'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000002f', '80000000-0000-0000-0050-000000000018', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000018'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000030', '80000000-0000-0000-0050-000000000018', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '13 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000018'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-000000000019', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Đau nửa đầu Migraine không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000019'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000031', '80000000-0000-0000-0050-000000000019', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000019'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000032', '80000000-0000-0000-0050-000000000019', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000019'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000001a', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Rối loạn tiền đình (bệnh Ménière) (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000033', '80000000-0000-0000-0050-00000000001a', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000034', '80000000-0000-0000-0050-00000000001a', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '14 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000001b', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Hen phế quản không đặc hiệu (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000035', '80000000-0000-0000-0050-00000000001b', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000036', '80000000-0000-0000-0050-00000000001b', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000001c', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Nhiễm khuẩn hô hấp trên cấp tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000037', '80000000-0000-0000-0050-00000000001c', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000038', '80000000-0000-0000-0050-00000000001c', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '15 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000001d', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Bướu nhân tuyến giáp đơn độc lành tính (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-000000000039', '80000000-0000-0000-0050-00000000001d', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000003a', '80000000-0000-0000-0050-00000000001d', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plans (
    id, patient_profile_id, appointment_id, doctor_id, title, status,
    starts_at, ends_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0050-00000000001e', a.patient_id, a.id, a.doctor_id,
    'Kế hoạch theo dõi điều trị Sỏi thận và sỏi niệu quản (Giai đoạn 1)', 'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP + INTERVAL '60 days',
    CURRENT_TIMESTAMP + INTERVAL '300 days', false,
    CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000003b', '80000000-0000-0000-0050-00000000001e', a.patient_id, a.id, a.doctor_id, 1, 'Đo và ghi lại huyết áp/đường huyết mỗi sáng lúc đói', 'Nhắc nhở qua app vào 07:00 sáng', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_care_plan_items (
    id, care_plan_id, patient_profile_id, appointment_id, doctor_id,
    sequence_number, goal, reminder, status, due_at, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0055-00000000003c', '80000000-0000-0000-0050-00000000001e', a.patient_id, a.id, a.doctor_id, 2, 'Tái khám định kỳ sau 30 ngày và làm xét nghiệm kiểm tra', 'Đặt lịch hẹn tái khám trước 3 ngày', 'OPEN', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '300 days', false, CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '16 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000001e'
  ON CONFLICT (id) DO NOTHING;


-- 8. Consultation Threads & Messages (20 threads, 40 msgs)

  -- Ensure all patient profiles have an active PATIENT user account
  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    'patient_' || replace(p.id::text, '-', '') || '@healthcare.id.vn',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye',
    p.full_name,
    'ACTIVE',
    true,
    CURRENT_TIMESTAMP - INTERVAL '120 days',
    CURRENT_TIMESTAMP - INTERVAL '120 days'
  FROM patient_profiles p
  WHERE p.user_id IS NULL
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  SELECT
    u.id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    CURRENT_TIMESTAMP - INTERVAL '120 days'
  FROM users u
  WHERE u.email LIKE 'patient_%@healthcare.id.vn'
  ON CONFLICT (user_id, role_id) DO NOTHING;

  UPDATE patient_profiles p
     SET user_id = u.id
    FROM users u
   WHERE p.user_id IS NULL
     AND u.email = 'patient_' || replace(p.id::text, '-', '') || '@healthcare.id.vn';

  -- Ensure doctors for these appointments have active DOCTOR user accounts
  INSERT INTO users (id, email, password_hash, display_name, status, email_verified, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    'doctor_' || replace(d.id::text, '-', '') || '@healthcare.id.vn',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8kRj3.G/M8G41k91FwK6JqG1Zt2Jye',
    d.full_name,
    'ACTIVE',
    true,
    CURRENT_TIMESTAMP - INTERVAL '120 days',
    CURRENT_TIMESTAMP - INTERVAL '120 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE d.user_id IS NULL
  GROUP BY d.id, d.full_name
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO user_roles (user_id, role_id, assigned_at)
  SELECT
    u.id,
    '00000000-0000-0000-0000-000000000002'::uuid,
    CURRENT_TIMESTAMP - INTERVAL '120 days'
  FROM users u
  WHERE u.email LIKE 'doctor_%@healthcare.id.vn'
  ON CONFLICT (user_id, role_id) DO NOTHING;

  UPDATE doctors d
     SET user_id = u.id
    FROM users u
   WHERE d.user_id IS NULL
     AND u.email = 'doctor_' || replace(d.id::text, '-', '') || '@healthcare.id.vn';

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000001', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Tăng huyết áp vô căn (nguyên phát)',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000001', '80000000-0000-0000-0060-000000000001', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000002', '80000000-0000-0000-0060-000000000001', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000001', '80000000-0000-0000-0060-000000000001', 1, p.user_id, '80000000-0000-0000-0065-000000000001', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Tăng huyết áp vô căn (nguyên phát) ạ.',
    'msg:80000000-0000-0000-0060-000000000001:1',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000002', '80000000-0000-0000-0060-000000000001', 2, d.user_id, '80000000-0000-0000-0065-000000000002', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000001:2',
    (CURRENT_TIMESTAMP - INTERVAL '1 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '1 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000001', '80000000-0000-0000-0060-000000000001', p.user_id, '80000000-0000-0000-0070-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '1 days',
    (CURRENT_TIMESTAMP - INTERVAL '1 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '1 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000001', '80000000-0000-0000-0060-000000000001', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000001"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000001'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000002', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Đái tháo đường typ 2 không có biến chứng',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000003', '80000000-0000-0000-0060-000000000002', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000004', '80000000-0000-0000-0060-000000000002', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000003', '80000000-0000-0000-0060-000000000002', 1, p.user_id, '80000000-0000-0000-0065-000000000003', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Đái tháo đường typ 2 không có biến chứng ạ.',
    'msg:80000000-0000-0000-0060-000000000002:1',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000004', '80000000-0000-0000-0060-000000000002', 2, d.user_id, '80000000-0000-0000-0065-000000000004', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000002:2',
    (CURRENT_TIMESTAMP - INTERVAL '1 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '1 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000002', '80000000-0000-0000-0060-000000000002', p.user_id, '80000000-0000-0000-0070-000000000004',
    CURRENT_TIMESTAMP - INTERVAL '1 days',
    (CURRENT_TIMESTAMP - INTERVAL '1 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '1 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000002', '80000000-0000-0000-0060-000000000002', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000003"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000002'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000003', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000005', '80000000-0000-0000-0060-000000000003', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000006', '80000000-0000-0000-0060-000000000003', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000005', '80000000-0000-0000-0060-000000000003', 1, p.user_id, '80000000-0000-0000-0065-000000000005', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Bệnh trào ngược dạ dày - thực quản có viêm thực quản ạ.',
    'msg:80000000-0000-0000-0060-000000000003:1',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000006', '80000000-0000-0000-0060-000000000003', 2, d.user_id, '80000000-0000-0000-0065-000000000006', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000003:2',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000003', '80000000-0000-0000-0060-000000000003', p.user_id, '80000000-0000-0000-0070-000000000006',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000003', '80000000-0000-0000-0060-000000000003', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000005"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000003'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000004', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Thoái hóa khớp gối nguyên phát hai bên',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000007', '80000000-0000-0000-0060-000000000004', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000008', '80000000-0000-0000-0060-000000000004', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000007', '80000000-0000-0000-0060-000000000004', 1, p.user_id, '80000000-0000-0000-0065-000000000007', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Thoái hóa khớp gối nguyên phát hai bên ạ.',
    'msg:80000000-0000-0000-0060-000000000004:1',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000008', '80000000-0000-0000-0060-000000000004', 2, d.user_id, '80000000-0000-0000-0065-000000000008', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000004:2',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000004', '80000000-0000-0000-0060-000000000004', p.user_id, '80000000-0000-0000-0070-000000000008',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    (CURRENT_TIMESTAMP - INTERVAL '2 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000004', '80000000-0000-0000-0060-000000000004', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000007"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000005', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Đau nửa đầu Migraine không đặc hiệu',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000009', '80000000-0000-0000-0060-000000000005', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000a', '80000000-0000-0000-0060-000000000005', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000009', '80000000-0000-0000-0060-000000000005', 1, p.user_id, '80000000-0000-0000-0065-000000000009', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Đau nửa đầu Migraine không đặc hiệu ạ.',
    'msg:80000000-0000-0000-0060-000000000005:1',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000a', '80000000-0000-0000-0060-000000000005', 2, d.user_id, '80000000-0000-0000-0065-00000000000a', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000005:2',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000005', '80000000-0000-0000-0060-000000000005', p.user_id, '80000000-0000-0000-0070-00000000000a',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000005', '80000000-0000-0000-0060-000000000005', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000009"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000005'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000006', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Rối loạn tiền đình (bệnh Ménière)',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000b', '80000000-0000-0000-0060-000000000006', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000c', '80000000-0000-0000-0060-000000000006', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000b', '80000000-0000-0000-0060-000000000006', 1, p.user_id, '80000000-0000-0000-0065-00000000000b', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Rối loạn tiền đình (bệnh Ménière) ạ.',
    'msg:80000000-0000-0000-0060-000000000006:1',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000c', '80000000-0000-0000-0060-000000000006', 2, d.user_id, '80000000-0000-0000-0065-00000000000c', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000006:2',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000006', '80000000-0000-0000-0060-000000000006', p.user_id, '80000000-0000-0000-0070-00000000000c',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    (CURRENT_TIMESTAMP - INTERVAL '3 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000006', '80000000-0000-0000-0060-000000000006', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000000b"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000006'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000007', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Hen phế quản không đặc hiệu',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000d', '80000000-0000-0000-0060-000000000007', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000e', '80000000-0000-0000-0060-000000000007', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000d', '80000000-0000-0000-0060-000000000007', 1, p.user_id, '80000000-0000-0000-0065-00000000000d', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Hen phế quản không đặc hiệu ạ.',
    'msg:80000000-0000-0000-0060-000000000007:1',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000e', '80000000-0000-0000-0060-000000000007', 2, d.user_id, '80000000-0000-0000-0065-00000000000e', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000007:2',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000007', '80000000-0000-0000-0060-000000000007', p.user_id, '80000000-0000-0000-0070-00000000000e',
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000007', '80000000-0000-0000-0060-000000000007', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000000d"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000007'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000008', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Nhiễm khuẩn hô hấp trên cấp tính',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000000f', '80000000-0000-0000-0060-000000000008', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000010', '80000000-0000-0000-0060-000000000008', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000000f', '80000000-0000-0000-0060-000000000008', 1, p.user_id, '80000000-0000-0000-0065-00000000000f', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Nhiễm khuẩn hô hấp trên cấp tính ạ.',
    'msg:80000000-0000-0000-0060-000000000008:1',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000010', '80000000-0000-0000-0060-000000000008', 2, d.user_id, '80000000-0000-0000-0065-000000000010', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000008:2',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000008', '80000000-0000-0000-0060-000000000008', p.user_id, '80000000-0000-0000-0070-000000000010',
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    (CURRENT_TIMESTAMP - INTERVAL '4 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000008', '80000000-0000-0000-0060-000000000008', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000000f"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000008'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000009', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Bướu nhân tuyến giáp đơn độc lành tính',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000011', '80000000-0000-0000-0060-000000000009', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000012', '80000000-0000-0000-0060-000000000009', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000011', '80000000-0000-0000-0060-000000000009', 1, p.user_id, '80000000-0000-0000-0065-000000000011', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Bướu nhân tuyến giáp đơn độc lành tính ạ.',
    'msg:80000000-0000-0000-0060-000000000009:1',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000012', '80000000-0000-0000-0060-000000000009', 2, d.user_id, '80000000-0000-0000-0065-000000000012', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000009:2',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000009', '80000000-0000-0000-0060-000000000009', p.user_id, '80000000-0000-0000-0070-000000000012',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000009', '80000000-0000-0000-0060-000000000009', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000011"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000009'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000a', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Sỏi thận và sỏi niệu quản',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000013', '80000000-0000-0000-0060-00000000000a', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000014', '80000000-0000-0000-0060-00000000000a', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000013', '80000000-0000-0000-0060-00000000000a', 1, p.user_id, '80000000-0000-0000-0065-000000000013', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Sỏi thận và sỏi niệu quản ạ.',
    'msg:80000000-0000-0000-0060-00000000000a:1',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000014', '80000000-0000-0000-0060-00000000000a', 2, d.user_id, '80000000-0000-0000-0065-000000000014', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000a:2',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000a', '80000000-0000-0000-0060-00000000000a', p.user_id, '80000000-0000-0000-0070-000000000014',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    (CURRENT_TIMESTAMP - INTERVAL '5 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000a', '80000000-0000-0000-0060-00000000000a', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000013"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000a'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000b', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Tăng huyết áp vô căn (nguyên phát)',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000015', '80000000-0000-0000-0060-00000000000b', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000016', '80000000-0000-0000-0060-00000000000b', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000015', '80000000-0000-0000-0060-00000000000b', 1, p.user_id, '80000000-0000-0000-0065-000000000015', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Tăng huyết áp vô căn (nguyên phát) ạ.',
    'msg:80000000-0000-0000-0060-00000000000b:1',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000016', '80000000-0000-0000-0060-00000000000b', 2, d.user_id, '80000000-0000-0000-0065-000000000016', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000b:2',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000b', '80000000-0000-0000-0060-00000000000b', p.user_id, '80000000-0000-0000-0070-000000000016',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000b', '80000000-0000-0000-0060-00000000000b', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000015"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000b'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000c', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Đái tháo đường typ 2 không có biến chứng',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000017', '80000000-0000-0000-0060-00000000000c', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000018', '80000000-0000-0000-0060-00000000000c', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000017', '80000000-0000-0000-0060-00000000000c', 1, p.user_id, '80000000-0000-0000-0065-000000000017', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Đái tháo đường typ 2 không có biến chứng ạ.',
    'msg:80000000-0000-0000-0060-00000000000c:1',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000018', '80000000-0000-0000-0060-00000000000c', 2, d.user_id, '80000000-0000-0000-0065-000000000018', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000c:2',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000c', '80000000-0000-0000-0060-00000000000c', p.user_id, '80000000-0000-0000-0070-000000000018',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    (CURRENT_TIMESTAMP - INTERVAL '6 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000c', '80000000-0000-0000-0060-00000000000c', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000017"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000c'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000d', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Bệnh trào ngược dạ dày - thực quản có viêm thực quản',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000019', '80000000-0000-0000-0060-00000000000d', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001a', '80000000-0000-0000-0060-00000000000d', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000019', '80000000-0000-0000-0060-00000000000d', 1, p.user_id, '80000000-0000-0000-0065-000000000019', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Bệnh trào ngược dạ dày - thực quản có viêm thực quản ạ.',
    'msg:80000000-0000-0000-0060-00000000000d:1',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001a', '80000000-0000-0000-0060-00000000000d', 2, d.user_id, '80000000-0000-0000-0065-00000000001a', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000d:2',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000d', '80000000-0000-0000-0060-00000000000d', p.user_id, '80000000-0000-0000-0070-00000000001a',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000d', '80000000-0000-0000-0060-00000000000d', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000019"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000d'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000e', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Thoái hóa khớp gối nguyên phát hai bên',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001b', '80000000-0000-0000-0060-00000000000e', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001c', '80000000-0000-0000-0060-00000000000e', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001b', '80000000-0000-0000-0060-00000000000e', 1, p.user_id, '80000000-0000-0000-0065-00000000001b', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Thoái hóa khớp gối nguyên phát hai bên ạ.',
    'msg:80000000-0000-0000-0060-00000000000e:1',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001c', '80000000-0000-0000-0060-00000000000e', 2, d.user_id, '80000000-0000-0000-0065-00000000001c', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000e:2',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000e', '80000000-0000-0000-0060-00000000000e', p.user_id, '80000000-0000-0000-0070-00000000001c',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    (CURRENT_TIMESTAMP - INTERVAL '7 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000e', '80000000-0000-0000-0060-00000000000e', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000001b"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000e'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-00000000000f', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Đau nửa đầu Migraine không đặc hiệu',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001d', '80000000-0000-0000-0060-00000000000f', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001e', '80000000-0000-0000-0060-00000000000f', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001d', '80000000-0000-0000-0060-00000000000f', 1, p.user_id, '80000000-0000-0000-0065-00000000001d', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Đau nửa đầu Migraine không đặc hiệu ạ.',
    'msg:80000000-0000-0000-0060-00000000000f:1',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001e', '80000000-0000-0000-0060-00000000000f', 2, d.user_id, '80000000-0000-0000-0065-00000000001e', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-00000000000f:2',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-00000000000f', '80000000-0000-0000-0060-00000000000f', p.user_id, '80000000-0000-0000-0070-00000000001e',
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-00000000000f', '80000000-0000-0000-0060-00000000000f', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000001d"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-00000000000f'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000010', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Rối loạn tiền đình (bệnh Ménière)',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-00000000001f', '80000000-0000-0000-0060-000000000010', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000020', '80000000-0000-0000-0060-000000000010', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-00000000001f', '80000000-0000-0000-0060-000000000010', 1, p.user_id, '80000000-0000-0000-0065-00000000001f', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Rối loạn tiền đình (bệnh Ménière) ạ.',
    'msg:80000000-0000-0000-0060-000000000010:1',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000020', '80000000-0000-0000-0060-000000000010', 2, d.user_id, '80000000-0000-0000-0065-000000000020', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000010:2',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000010', '80000000-0000-0000-0060-000000000010', p.user_id, '80000000-0000-0000-0070-000000000020',
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    (CURRENT_TIMESTAMP - INTERVAL '8 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000010', '80000000-0000-0000-0060-000000000010', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-00000000001f"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000010'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000011', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Hen phế quản không đặc hiệu',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000021', '80000000-0000-0000-0060-000000000011', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000022', '80000000-0000-0000-0060-000000000011', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000021', '80000000-0000-0000-0060-000000000011', 1, p.user_id, '80000000-0000-0000-0065-000000000021', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Hen phế quản không đặc hiệu ạ.',
    'msg:80000000-0000-0000-0060-000000000011:1',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000022', '80000000-0000-0000-0060-000000000011', 2, d.user_id, '80000000-0000-0000-0065-000000000022', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000011:2',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000011', '80000000-0000-0000-0060-000000000011', p.user_id, '80000000-0000-0000-0070-000000000022',
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000011', '80000000-0000-0000-0060-000000000011', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000021"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000011'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000012', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Nhiễm khuẩn hô hấp trên cấp tính',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000023', '80000000-0000-0000-0060-000000000012', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000024', '80000000-0000-0000-0060-000000000012', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000023', '80000000-0000-0000-0060-000000000012', 1, p.user_id, '80000000-0000-0000-0065-000000000023', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Nhiễm khuẩn hô hấp trên cấp tính ạ.',
    'msg:80000000-0000-0000-0060-000000000012:1',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000024', '80000000-0000-0000-0060-000000000012', 2, d.user_id, '80000000-0000-0000-0065-000000000024', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000012:2',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000012', '80000000-0000-0000-0060-000000000012', p.user_id, '80000000-0000-0000-0070-000000000024',
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    (CURRENT_TIMESTAMP - INTERVAL '9 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '9 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000012', '80000000-0000-0000-0060-000000000012', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000023"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000012'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000013', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Bướu nhân tuyến giáp đơn độc lành tính',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000025', '80000000-0000-0000-0060-000000000013', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '11 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000026', '80000000-0000-0000-0060-000000000013', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '11 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000025', '80000000-0000-0000-0060-000000000013', 1, p.user_id, '80000000-0000-0000-0065-000000000025', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Bướu nhân tuyến giáp đơn độc lành tính ạ.',
    'msg:80000000-0000-0000-0060-000000000013:1',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000026', '80000000-0000-0000-0060-000000000013', 2, d.user_id, '80000000-0000-0000-0065-000000000026', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000013:2',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000013', '80000000-0000-0000-0060-000000000013', p.user_id, '80000000-0000-0000-0070-000000000026',
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000013', '80000000-0000-0000-0060-000000000013', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000025"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_threads (
    id, appointment_id, patient_profile_id, doctor_id, status,
    subject, consultation_open_until, retention_expires_at, version, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0060-000000000014', a.id, a.patient_id, a.doctor_id, 'OPEN',
    'Tư vấn lâm sàng trực tuyến chuyên khoa Sỏi thận và sỏi niệu quản',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '30 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '90 days',
    0, false,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (appointment_id) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000027', '80000000-0000-0000-0060-000000000014', p.user_id, 'PATIENT', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '11 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_participants (
    id, thread_id, user_id, participant_role, assigned_by_user_id, assignment_permission, assignment_metadata, joined_at, retention_expires_at, synthetic_fixture
  )
  SELECT
    '80000000-0000-0000-0065-000000000028', '80000000-0000-0000-0060-000000000014', d.user_id, 'ASSIGNED_DOCTOR', '90000000-0000-0000-0000-000000000001', 'METADATA_ONLY', '{}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '11 days',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000027', '80000000-0000-0000-0060-000000000014', 1, p.user_id, '80000000-0000-0000-0065-000000000027', 'PATIENT', 'TEXT',
    'Chào bác sĩ, xin bác sĩ hướng dẫn thêm về chế độ ăn uống cho bệnh Sỏi thận và sỏi niệu quản ạ.',
    'msg:80000000-0000-0000-0060-000000000014:1',
    (CURRENT_TIMESTAMP - INTERVAL '11 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_messages (
    id, thread_id, sequence_number, author_user_id, author_participant_id,
    author_role_snapshot, message_kind, body, idempotency_key, retention_expires_at, synthetic_fixture, created_at
  )
  SELECT
    '80000000-0000-0000-0070-000000000028', '80000000-0000-0000-0060-000000000014', 2, d.user_id, '80000000-0000-0000-0065-000000000028', 'DOCTOR', 'TEXT',
    'Chào bạn, bạn nên giảm muối dưới 5g/ngày, tăng cường rau xanh, uống đủ nước và duy trì uống thuốc đúng giờ nhé.',
    'msg:80000000-0000-0000-0060-000000000014:2',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    false,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN doctors d ON a.doctor_id = d.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO patient_consultation_read_states (id, thread_id, user_id, last_read_message_id, last_read_at, retention_expires_at, updated_at)
  SELECT
    '80000000-0000-0000-0075-000000000014', '80000000-0000-0000-0060-000000000014', p.user_id, '80000000-0000-0000-0070-000000000028',
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    (CURRENT_TIMESTAMP - INTERVAL '10 days') + INTERVAL '80 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO patient_consultation_events (id, thread_id, event_type, actor_user_id, actor_role_snapshot, correlation_id, metadata, occurred_at)
  SELECT
    '80000000-0000-0000-0078-000000000014', '80000000-0000-0000-0060-000000000014', 'MESSAGE_SENT', p.user_id, 'PATIENT', gen_random_uuid(), '{"message_id": "80000000-0000-0000-0070-000000000027"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '11 days'
  FROM appointments a
  JOIN patient_profiles p ON a.patient_id = p.id
  WHERE a.id = '80000000-0000-0000-0010-000000000014'
  ON CONFLICT (id) DO NOTHING;


-- 9. Health Q&As (10 questions, 10 approved answers)

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000001', p.id, p.user_id, 'cach-xu-tri-khi-huyet-ap-tang-dot-ngot-tai-nha',
    'Huyết áp đột ngột tăng lên 160/100 mmHg tại nhà kèm đau đầu nhẹ thì nên xử trí thế nào?', 'NguoiBenh_200', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000004'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000001', '80000000-0000-0000-0080-000000000001', 1, '90000000-0000-0000-0000-000000000023', 'Bạn nên nằm nghỉ ngơi tại phòng yên tĩnh thoáng khí, uống thuốc hạ áp theo toa bác sĩ đã kê trước đó, đo lại huyết áp sau 15-30 phút. Nếu kèm đau ngực hoặc yếu tay chân, cần gọi 115 ngay.',
    'cc4a8b8a2aee5298d23a26ebd41c6cefb38558cf1624e9fd483e30f698f925a3', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000002', p.id, p.user_id, 'chi-so-hba1c-bao-nhieu-la-an-toan-cho-nguoi-tieu-duong',
    'Chỉ số HbA1c bao nhiêu là an toàn và kiểm soát tốt cho người bệnh đái tháo đường?', 'NguoiBenh_201', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000013'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000002', '80000000-0000-0000-0080-000000000002', 1, '90000000-0000-0000-0000-000000000023', 'Mục tiêu HbA1c chung cho hầu hết người trưởng thành mắc đái tháo đường là dưới 7.0%. Với người trẻ tuổi có thể duy trì dưới 6.5%, người cao tuổi có thể nới lỏng mức 7.5 - 8.0%.',
    '7d084c2f2dbcbc2d2ebf06685610e8c873ac680e9b92b816626fc6260f29d8f3', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000003', p.id, p.user_id, 'dau-da-day-co-nen-uong-nuoc-cam-chanh-khong',
    'Đang bị viêm loét dạ dày tá tràng thì có được uống nước cam, nước chanh không bác sĩ?', 'NguoiBenh_202', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000014'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000003', '80000000-0000-0000-0080-000000000003', 1, '90000000-0000-0000-0000-000000000023', 'Không nên uống nước cam, chanh khi dạ dày đang viêm loét cấp, vì acid citric trong cam chanh sẽ kích thích niêm mạc dạ dày gây tăng tiết acid, tăng cảm giác đau rát và khó lành tổn thương.',
    'faf0cf3bd92b9b7cf95f81e84916f5584adbb151d8d8d0ab4659903332e248fe', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000004', p.id, p.user_id, 'dau-nhuc-khop-goi-khi-thoi-tiet-thay-doi-la-benh-gi',
    'Cứ mỗi khi trời lạnh hoặc đổi mùa là khớp gối lại đau nhức buốt, có phải bị thoái hóa khớp không?', 'NguoiBenh_203', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000201'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000004', '80000000-0000-0000-0080-000000000004', 1, '90000000-0000-0000-0000-000000000023', 'Rất có thể bạn bị thoái hóa khớp gối hoặc viêm màng hoạt dịch khớp mạn tính. Áp suất khí quyển và nhiệt độ giảm làm co mạch máu quanh khớp. Bạn nên đi chụp X-quang để đánh giá mức độ thoái hóa.',
    'd224742253ac45104b84eba0cfff3914005b953592ac1dd25be58c59f0c51374', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000005', p.id, p.user_id, 'dau-dau-mot-ben-kem-buon-non-la-migraine-hay-suy-nhuoc',
    'Tôi thường xuyên đau nhức một nửa đầu, sợ ánh sáng và buồn nôn thì là bệnh gì?', 'NguoiBenh_204', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000202'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000005', '80000000-0000-0000-0080-000000000005', 1, '90000000-0000-0000-0000-000000000023', 'Các triệu chứng đau nửa đầu giật theo nhịp mạch, sợ ánh sáng và buồn nôn rất đặc trưng cho đau nửa đầu Migraine. Bạn nên đi khám chuyên khoa Nội Thần kinh để có phác đồ cắt cơn và phòng ngừa phù hợp.',
    '88eaebab454e4a7f3c6eabbab8c42824f7039bb0de1b6d6e18f347a7cf4e6312', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000006', p.id, p.user_id, 'trieu-chung-chong-mat-khi-quay-dau-co-phai-thieu-mau-nao',
    'Mỗi khi nằm quay đầu sang một bên là trần nhà quay cuồng, đứng dậy chao đảo là bị gì?', 'NguoiBenh_205', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000203'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000006', '80000000-0000-0000-0080-000000000006', 1, '90000000-0000-0000-0000-000000000023', 'Đây là triệu chứng điển hình của chóng mặt kịch phát tư thế lành tính (BPPV) hoặc rối loạn tiền đình. Bác sĩ có thể thực hiện thủ thuật tái định vị sỏi tai (Epley) để điều trị dứt điểm nhanh chóng.',
    '1d5759f5d0c48d9eb741422be4301e89f14f1efea10a1115b10c34d8aa982677', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000007', p.id, p.user_id, 'be-3-thang-tuoi-kho-khe-ve-dem-khi-nao-can-di-kham',
    'Bé sơ sinh 3 tháng hay khò khè bú ngắt quãng, thở nhanh thì khi nào cần cho đi khám?', 'NguoiBenh_206', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000204'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000007', '80000000-0000-0000-0080-000000000007', 1, '90000000-0000-0000-0000-000000000023', 'Nếu bé bú kém, thở co rút hõm ức, sốt hoặc thở trên 50 lần/phút, cha mẹ cần đưa bé đi khám chuyên khoa Nhi ngay vì có nguy cơ viêm tiểu phế quản hoặc viêm phổi cấp.',
    'abd854cb0374ccd6aad2adedc73d5f542ba92c061b198e2bed6801fbcda808b0', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000008', p.id, p.user_id, 'nhan-tuyen-giap-tirads-3-co-nguy-co-ung-thu-khong',
    'Kết quả siêu âm có nhân giáp TIRADS 3 kích thước 10mm thì có phải mổ hay có nguy cơ ung thư không?', 'NguoiBenh_207', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000205'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000008', '80000000-0000-0000-0080-000000000008', 1, '90000000-0000-0000-0000-000000000023', 'TIRADS 3 là tổn thương có khả năng lành tính cao (nguy cơ ác tính dưới 5%). Với kích thước 10mm bạn chưa cần can thiệp phẫu thuật, chỉ cần siêu âm định kỳ 6-12 tháng một lần để theo dõi.',
    '6770805b0a621308fcf719c48892f93557f1484062c5efc1c5bd3da055b5c072', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-000000000009', p.id, p.user_id, 'soi-than-5mm-uong-nuoc-nhieu-co-tu-ra-duoc-khong',
    'Tôi siêu âm có sỏi đài dưới thận 5mm, uống nhiều nước có tự tống xuất ra ngoài được không?', 'NguoiBenh_208', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000022'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-000000000009', '80000000-0000-0000-0080-000000000009', 1, '90000000-0000-0000-0000-000000000023', 'Sỏi kích thước dưới 5-6mm có khả năng tự đào thải qua đường tiểu khoảng 60-80% nếu bạn uống đủ 2-2.5 lít nước mỗi ngày kết hợp vận động nhẹ nhàng và dùng thuốc giãn cơ trơn đường niệu theo chỉ định.',
    '3ff0d274c5403122b39c70b690f72f7dd7f6e8d8a5c219fb5f2079d4123bf842', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_questions (
    id, patient_profile_id, author_user_id, topic_slug,
    normalized_question, public_alias, pii_scan_status,
    pii_scanned_at, status, retention_expires_at, synthetic_fixture, created_at, updated_at
  )
  SELECT
    '80000000-0000-0000-0080-00000000000a', p.id, p.user_id, 'kham-suc-khoe-tong-quat-dinh-ky-bao-lau-mot-lan',
    'Người bình thường không có bệnh nền thì nên khám sức khỏe tổng quát định kỳ bao lâu một lần?', 'NguoiBenh_209', 'CLEAR',
    CURRENT_TIMESTAMP - INTERVAL '30 days', 'PUBLISHED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days'
  FROM patient_profiles p
  WHERE p.id = '90000000-0000-0000-0000-000000000206'
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO health_question_answers (
    id, question_id, revision, doctor_user_id, answer_text,
    answer_hash, status, reviewer_user_id, reviewed_at,
    review_reason_code, retention_expires_at, synthetic_fixture, created_at
  ) VALUES (
    '80000000-0000-0000-0085-00000000000a', '80000000-0000-0000-0080-00000000000a', 1, '90000000-0000-0000-0000-000000000023', 'Người trưởng thành khỏe mạnh nên khám sức khỏe định kỳ mỗi năm một lần. Người trên 50 tuổi hoặc có yếu tố nguy cơ gia đình (ung thư, tim mạch) nên kiểm tra chuyên sâu 6 tháng/lần.',
    '21a12c9b5609e5413fd18292b0b0616fe64171538d6cb1f5f050b8e13454eeb5', 'APPROVED', '90000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '29 days', 'APPROVED', (CURRENT_TIMESTAMP - INTERVAL '30 days') + INTERVAL '60 days',
    false, CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;


-- 10. Bank Payments & Webhooks (20 payments, 20 audits, 20 webhooks)

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000001', '80000000-0000-0000-0010-000000000001', 300000, 'VND', 'HEALTHCARE_PAY_1000',
    'PAID', 'VCB_FT2026090010', CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000001', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000001', '80000000-0000-0000-0010-000000000001', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202600', '13965b108827a7ae39bb368184230576c19bb7011bc50426aba5ff5f49aecdf1', '80000000-0000-0000-0090-000000000001', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000002', '80000000-0000-0000-0010-000000000002', 500000, 'VND', 'HEALTHCARE_PAY_1001',
    'PAID', 'VCB_FT2026090011', CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000002', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000002', '80000000-0000-0000-0010-000000000002', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202601', '7d4e5a76eae6d8c165410ac19fe6756521ba86ed96752d0126b1953b155af052', '80000000-0000-0000-0090-000000000002', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000003', '80000000-0000-0000-0010-000000000003', 700000, 'VND', 'HEALTHCARE_PAY_1002',
    'PAID', 'VCB_FT2026090012', CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000003', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000003', '80000000-0000-0000-0010-000000000003', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202602', 'e7a53ae46b784f8fc1105e6029d8fccfe1fe39123bde961cb79249e7179ac11a', '80000000-0000-0000-0090-000000000003', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000004', '80000000-0000-0000-0010-000000000004', 900000, 'VND', 'HEALTHCARE_PAY_1003',
    'PAID', 'VCB_FT2026090013', CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000004', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000004', '80000000-0000-0000-0010-000000000004', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202603', '701c5b0ac75b357ff425481b4ec65eb5258d18510478ee276c72ab667b2eb75a', '80000000-0000-0000-0090-000000000004', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000005', '80000000-0000-0000-0010-000000000005', 1100000, 'VND', 'HEALTHCARE_PAY_1004',
    'PAID', 'VCB_FT2026090014', CURRENT_TIMESTAMP - INTERVAL '4 days',
    CURRENT_TIMESTAMP - INTERVAL '4 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000005', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000005', '80000000-0000-0000-0010-000000000005', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202604', '6c5c3b1b11a7e414670702b0a8153aa4409af3a9065fdaf737151f949f0974bb', '80000000-0000-0000-0090-000000000005', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000006', '80000000-0000-0000-0010-000000000006', 300000, 'VND', 'HEALTHCARE_PAY_1005',
    'PAID', 'VCB_FT2026090015', CURRENT_TIMESTAMP - INTERVAL '4 days',
    CURRENT_TIMESTAMP - INTERVAL '4 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000006', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000006', '80000000-0000-0000-0010-000000000006', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202605', '6cfeaa7263d00e01b9699d930731735e5dea99c28d29eb42a378df4b7b88cae9', '80000000-0000-0000-0090-000000000006', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000007', '80000000-0000-0000-0010-000000000007', 500000, 'VND', 'HEALTHCARE_PAY_1006',
    'PAID', 'VCB_FT2026090016', CURRENT_TIMESTAMP - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000007', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000007', '80000000-0000-0000-0010-000000000007', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202606', 'd058567c39b8530ae7ff56daaf4fdfcaa4b1f0cf236aaf4e4ae378e69d2b03cf', '80000000-0000-0000-0090-000000000007', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000008', '80000000-0000-0000-0010-000000000008', 700000, 'VND', 'HEALTHCARE_PAY_1007',
    'PAID', 'VCB_FT2026090017', CURRENT_TIMESTAMP - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000008', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000008', '80000000-0000-0000-0010-000000000008', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202607', 'b1cca50f7e0c59d25184ed862b2b461a28069dbc294959699c501776ca317c69', '80000000-0000-0000-0090-000000000008', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000009', '80000000-0000-0000-0010-000000000009', 900000, 'VND', 'HEALTHCARE_PAY_1008',
    'PAID', 'VCB_FT2026090018', CURRENT_TIMESTAMP - INTERVAL '6 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000009', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000009', '80000000-0000-0000-0010-000000000009', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202608', 'd8f790dc9942b917c24ffc1097282c63f5d477447d0eb11502d33c3378530a1e', '80000000-0000-0000-0090-000000000009', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000a', '80000000-0000-0000-0010-00000000000a', 1100000, 'VND', 'HEALTHCARE_PAY_1009',
    'PAID', 'VCB_FT2026090019', CURRENT_TIMESTAMP - INTERVAL '6 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000a', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000a', '80000000-0000-0000-0010-00000000000a', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202609', '529ba477cee238309ec056f6268fd50ce25850255d357e95c8db12d8e46df32e', '80000000-0000-0000-0090-00000000000a', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000b', '80000000-0000-0000-0010-00000000000b', 300000, 'VND', 'HEALTHCARE_PAY_1010',
    'PAID', 'VCB_FT2026090020', CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000b', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000b', '80000000-0000-0000-0010-00000000000b', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202610', 'ec1a80b2fc10d48ca9f09790c4b1b2b7c4f85d19cee5ca03abe541fbb62fdad5', '80000000-0000-0000-0090-00000000000b', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000c', '80000000-0000-0000-0010-00000000000c', 500000, 'VND', 'HEALTHCARE_PAY_1011',
    'PAID', 'VCB_FT2026090021', CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000c', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000c', '80000000-0000-0000-0010-00000000000c', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202611', '61812348ddcd82dcb4ca13eafc491f6116c4cd5d690330a9f80633f1b26106e3', '80000000-0000-0000-0090-00000000000c', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000d', '80000000-0000-0000-0010-00000000000d', 700000, 'VND', 'HEALTHCARE_PAY_1012',
    'PAID', 'VCB_FT2026090022', CURRENT_TIMESTAMP - INTERVAL '8 days',
    CURRENT_TIMESTAMP - INTERVAL '8 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000d', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000d', '80000000-0000-0000-0010-00000000000d', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202612', '8fc92111e0416369b6ec9b967d65176f46e44c097436c412e659df4fb0a93826', '80000000-0000-0000-0090-00000000000d', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000e', '80000000-0000-0000-0010-00000000000e', 900000, 'VND', 'HEALTHCARE_PAY_1013',
    'PAID', 'VCB_FT2026090023', CURRENT_TIMESTAMP - INTERVAL '8 days',
    CURRENT_TIMESTAMP - INTERVAL '8 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000e', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000e', '80000000-0000-0000-0010-00000000000e', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202613', '452d2d3ba9a7c95f271262902fca9f978fdf6cf12ef6ffd2b02cc2a041e32ac6', '80000000-0000-0000-0090-00000000000e', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-00000000000f', '80000000-0000-0000-0010-00000000000f', 1100000, 'VND', 'HEALTHCARE_PAY_1014',
    'PAID', 'VCB_FT2026090024', CURRENT_TIMESTAMP - INTERVAL '9 days',
    CURRENT_TIMESTAMP - INTERVAL '9 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-00000000000f', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-00000000000f', '80000000-0000-0000-0010-00000000000f', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202614', 'd20bca2c37da81feac2bda045c7f51f12d0ff292b48f2072e531bd1b1ba5a0b3', '80000000-0000-0000-0090-00000000000f', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000010', '80000000-0000-0000-0010-000000000010', 300000, 'VND', 'HEALTHCARE_PAY_1015',
    'PAID', 'VCB_FT2026090025', CURRENT_TIMESTAMP - INTERVAL '9 days',
    CURRENT_TIMESTAMP - INTERVAL '9 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000010', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000010', '80000000-0000-0000-0010-000000000010', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202615', '202ecff76dd0076008914d604c12a120087f1d26dc821258fc670cad41c58b43', '80000000-0000-0000-0090-000000000010', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000011', '80000000-0000-0000-0010-000000000011', 500000, 'VND', 'HEALTHCARE_PAY_1016',
    'PAID', 'VCB_FT2026090026', CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000011', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000011', '80000000-0000-0000-0010-000000000011', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202616', 'f4d7f46ff9d7399d7861a499a661c485f90ca0723823e7f8c4c37c3c351b96e2', '80000000-0000-0000-0090-000000000011', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000012', '80000000-0000-0000-0010-000000000012', 700000, 'VND', 'HEALTHCARE_PAY_1017',
    'PAID', 'VCB_FT2026090027', CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000012', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000012', '80000000-0000-0000-0010-000000000012', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202617', '755e41650d5e339b5c8800ef85f5e91043bff33b05ae961a43d54f4483fd4199', '80000000-0000-0000-0090-000000000012', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000013', '80000000-0000-0000-0010-000000000013', 900000, 'VND', 'HEALTHCARE_PAY_1018',
    'PAID', 'VCB_FT2026090028', CURRENT_TIMESTAMP - INTERVAL '11 days',
    CURRENT_TIMESTAMP - INTERVAL '11 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000013', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000013', '80000000-0000-0000-0010-000000000013', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202618', 'a7b09f3ed5ea7945159c10a9816e52951a26f2615a0142e4c24910c7117cf78b', '80000000-0000-0000-0090-000000000013', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (event_id) DO NOTHING;

  INSERT INTO bank_transfer_payments (
    id, appointment_id, amount, currency, transfer_content,
    status, transaction_reference, submitted_at, verified_at,
    version, created_at, updated_at
  ) VALUES (
    '80000000-0000-0000-0090-000000000014', '80000000-0000-0000-0010-000000000014', 1100000, 'VND', 'HEALTHCARE_PAY_1019',
    'PAID', 'VCB_FT2026090029', CURRENT_TIMESTAMP - INTERVAL '11 days',
    CURRENT_TIMESTAMP - INTERVAL '11 days', 0,
    CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_audit_logs (id, actor_email, action, payment_id, appointment_id, details, created_at)
  VALUES ('80000000-0000-0000-0095-000000000014', 'gateway@healthcare.id.vn', 'CONFIRM_PAYMENT', '80000000-0000-0000-0090-000000000014', '80000000-0000-0000-0010-000000000014', 'Hệ thống VietQR ghi nhận thanh toán tự động thành công', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO payment_webhook_events (event_id, payload_hash, payment_id, received_at, processed_at)
  VALUES ('wh_evt_202619', 'db63d58a8255da90401d48fc7b8048842589efc4dc11430acb53cbc21270caf1', '80000000-0000-0000-0090-000000000014', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '11 days')
  ON CONFLICT (event_id) DO NOTHING;


-- 11. Patient Documents (10 documents)

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000001', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202600.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '2 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000001:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000001'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000002', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202601.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '2 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000002:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000002'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000003', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202602.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '3 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000003:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000003'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000004', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202603.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '3 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000004:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000004'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000005', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202604.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '4 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000005:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000005'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000006', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202605.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '4 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000006:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000006'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000007', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202606.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '5 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000007:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000007'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000008', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202607.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '5 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000008:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000008'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-000000000009', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202608.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '6 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-000000000009:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-000000000009'
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO patient_documents (
    id, patient_id, source_record_id, source_type, source_version,
    template_version, status, object_key, sha256, byte_size,
    generated_by, generated_at, idempotency_key
  )
  SELECT
    '80000000-0000-0000-00a0-00000000000a', m.patient_id, m.id, 'VISIT_SUMMARY', 1,
    'v1.0', 'AVAILABLE', 'documents/clinical-summary-202609.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 384512,
    '90000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '6 days',
    'VISIT_SUMMARY:80000000-0000-0000-0020-00000000000a:1:v1.0'
  FROM medical_records m
  WHERE m.id = '80000000-0000-0000-0020-00000000000a'
  ON CONFLICT (idempotency_key) DO NOTHING;


-- 12. Doctor Schedule Exceptions (10 exceptions)

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000001', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', '7188f796-3d10-ca33-3d04-bfc7dab3932c', (CURRENT_DATE + INTERVAL '3 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000002', '00a2de74-0b8d-c45f-43f7-61f3d1f99612', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', (CURRENT_DATE + INTERVAL '6 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000003', '014624fb-6e10-8a38-b903-dcd2b742a8b1', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', (CURRENT_DATE + INTERVAL '9 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000004', '0155d6a0-5b06-f4a5-cc50-0e7fc94050ef', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', (CURRENT_DATE + INTERVAL '12 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000005', '02b35c5e-c9f9-5cea-222c-b91d6e3dc4a4', '83d56555-dc7c-f749-7271-04e0d1843da1', (CURRENT_DATE + INTERVAL '15 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000006', '0350e3c4-3915-37e1-a2ad-59d5b2004f2a', '7765688c-354a-229a-6704-e4e460ccf3fa', (CURRENT_DATE + INTERVAL '18 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000007', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', '535f4437-1f68-4926-14c8-2e9d29a4f684', (CURRENT_DATE + INTERVAL '21 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000008', '036a57a7-f401-0a9e-d51b-c6b7f7f6b755', 'c3ec3c77-c1b5-0982-4e2f-06411fd165e7', (CURRENT_DATE + INTERVAL '24 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-000000000009', '0467b23c-312e-25b9-af98-761fd1fffa9f', '7188f796-3d10-ca33-3d04-bfc7dab3932c', (CURRENT_DATE + INTERVAL '27 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO doctor_schedule_exceptions (
    id, doctor_id, branch_id, exception_date, type, custom_start_time, custom_end_time, reason
  ) VALUES (
    '80000000-0000-0000-00b0-00000000000a', '0467b23c-312e-25b9-af98-761fd1fffa9f', 'b8d0e0d9-6701-06bd-4eca-82216e9bd729', (CURRENT_DATE + INTERVAL '30 days')::date,
    'LEAVE', null, null, 'Tham dự Hội nghị Tim mạch Quốc tế & Công tác Hội chẩn'
  ) ON CONFLICT (id) DO NOTHING;


END $$;
