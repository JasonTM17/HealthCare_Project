-- ==============================================================================
-- LARGE seed dataset for pagination / search / performance testing.
-- Original fictional hospital content only — nothing copied from any real brand.
--
-- Scale (approx): specialties 30, branches 20, doctors 500, services 200,
-- packages 100, articles 500, faqs 150, doctor_specialties 1500,
-- doctor_branches 750, users 1000.
--
-- Idempotent: truncates domain tables (roles/permissions preserved) then
-- regenerates. Safe to re-run. Password hash is a BCrypt stub valid only for
-- local dev; never a real secret.
-- ==============================================================================

BEGIN;

TRUNCATE TABLE
    refresh_tokens,
    user_roles,
    users,
    doctor_branches,
    doctor_specialties,
    doctor_schedule_exceptions,
    doctor_schedules,
    articles,
    faqs,
    packages,
    services,
    doctors,
    branches,
    specialties
RESTART IDENTITY CASCADE;

-- ── Roles (re-seed the fixed baseline so user FKs resolve) ────────────────────
INSERT INTO roles (id, code, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'PATIENT', 'Patient'),
    ('00000000-0000-0000-0000-000000000002', 'DOCTOR', 'Doctor'),
    ('00000000-0000-0000-0000-000000000003', 'ADMIN', 'Administrator')
ON CONFLICT (code) DO NOTHING;

-- ── Specialties (30) ──────────────────────────────────────────────────────────
INSERT INTO specialties (id, name, slug, description, active)
SELECT gen_random_uuid(), name, slug, description, true
FROM (VALUES
    ('Tim mạch','tim-mach','Khám và điều trị bệnh lý tim, mạch máu, tăng huyết áp.'),
    ('Thần kinh','than-kinh','Khám và điều trị đau đầu, rối loạn giấc ngủ, bệnh lý thần kinh.'),
    ('Tiêu hóa','tieu-hoa','Khám và điều trị bệnh lý dạ dày, đại tràng, gan mật.'),
    ('Nội tổng hợp','noi-tong-hop','Khám sàng lọc, quản lý bệnh mãn tính.'),
    ('Nhi khoa','nhi-khoa','Khám và điều trị bệnh lý trẻ em.'),
    ('Sản phụ khoa','san-phu-khoa','Khám thai, tầm soát ung thư phụ khoa, sinh sản.'),
    ('Cơ xương khớp','co-xuong-khop','Điều trị đau khớp, thoái hóa cột sống, loãng xương.'),
    ('Tai mũi họng','tai-mui-hong','Điều trị viêm họng, viêm xoang, rối loạn tiền đình.'),
    ('Da liễu','da-lieu','Điều trị bệnh lý da, tóc, móng và thẩm mỹ da.'),
    ('Mắt','mat','Khám và điều trị bệnh lý mắt, đo kính.'),
    ('Răng hàm mặt','rang-ham-mat','Khám và điều trị răng, hàm, mặt.'),
    ('Tiết niệu','tiet-nieu','Điều trị bệnh lý thận, tiết niệu, nam khoa.'),
    ('Hô hấp','ho-hap','Khám và điều trị phổi, khí quản, dị ứng đường hô hấp.'),
    ('Nội tiết','noi-tiet','Điều trị tiểu đường, tuyến giáp, rối loạn chuyển hóa.'),
    ('Ung bướ','ung-buou','Theo dõi và điều trị ung bước, ung thư.'),
    ('Huyết học','huyet-hoc','Điều trị bệnh lý máu, thiếu máu, rối loạn đông máu.'),
    ('Ngoại khoa','ngoai-khoa','Phẫu thuật và can thiệp ngoại khoa tổng quát.'),
    ('Ngoại thần kinh','ngoai-than-kinh','Phẫu thuật sọ não, cột sống, dây thần kinh.'),
    ('Chấn thương chỉnh hinh','chan-thuong-chinh-hinh','Điều trị gãy xương, trật khớp, chấn thương.'),
    ('Phục hồi chức năng','phuc-hoi-chuc-năng','Vật lý trị liệu, phục hồi sau bệnh.'),
    ('Tâm thanh','tam-thanh','Đánh giá thính lực, rối loạn thính giác.'),
    ('Dinh dưỡng','dinh-duong','Tư vấn chế độ ăn, dinh dưỡng lâm sàng.'),
    ('Giải phẩu bệnh','giai-phau-benh','Chẩn đoán bệnh lý mô, xét nghiệm giải phẫu.'),
    ('Miễn dịch dị ứng','mien-dich-di-ung','Điều trị dị ứng, bệnh tự miễn.'),
    ('Nội mạch máu','noi-mach-mau','Can thiệp mạch máu nội bệnh, siêu âm Doppler.'),
    ('Sơ cấp cứu','so-cap-cuu','Xử trí cấp cứu, hồi sức tích cực.'),
    ('Y học cổ truyền','y-hoc-co-truyen','Bồi bổ, châm cứu, điều trị thuốc nam.'),
    ('Nam khoa','nam-khoa','Khám và điều trị bệnh lý nam giới.'),
    ('Da liễu thẩm mỹ','da-lieu-tham-may','Thẩm mỹ da, laser, điều trị sẹo.'),
    ('Y tế công cộng','y-te-cong-cong','Phòng bệnh, tiêm chủng, sức khỏe cộng đồng.')
) AS v(name, slug, description)
ON CONFLICT (slug) DO NOTHING;

-- ── Branches (20) ─────────────────────────────────────────────────────────────
INSERT INTO branches (id, name, slug, address, phone, active)
SELECT gen_random_uuid(),
       'Bệnh viện Đa khoa Sài Gòn Xanh - Cơ sở ' || s.idx,
       'cs-' || s.idx || '-' || md5(random()::text),
       (s.idx || ' Đường số ' || (s.idx % 30 + 1) || ', Quận ' || (s.idx % 12 + 1) || ', TP. Hồ Chí Minh'),
       '028 ' || lpad((38000000 + s.idx)::text, 8, '0'),
       true
FROM generate_series(1, 20) AS s(idx)
ON CONFLICT (slug) DO NOTHING;

-- ── Doctors (500) ─────────────────────────────────────────────────────────────
INSERT INTO doctors (id, full_name, slug, bio, photo_url, active)
SELECT gen_random_uuid(),
       names.ho[1 + (gs.idx % 5)] || ' ' || names.dem[1 + ((gs.idx * 3) % 6)] || ' ' || names.ten[1 + ((gs.idx * 7) % 8)],
       'bs-' || gs.idx || '-' || md5(random()::text),
       'Bác sĩ chuyên khoa với ' || (8 + (gs.idx % 15)) || ' năm kinh nghiệm điều trị và chăm sóc bệnh nhân.',
       NULL,
       (gs.idx % 20 <> 0)  -- 5% inactive to exercise active filters
FROM generate_series(1, 500) AS gs(idx),
     LATERAL (SELECT ARRAY['Nguyễn','Trần','Lê','Phạm','Võ','Đỗ','Bùi','Hoàng','Đặng','Ngô'] AS ho,
                     ARRAY['Văn','Thị','Minh','Quốc','Hoàng','Thanh','Thu','Ngọc','Anh'] AS dem,
                     ARRAY['Khôi','Hà','Đức','Yến','Huy','Mai','Long','Trung','Lan','Phúc'] AS ten) AS names
ON CONFLICT (slug) DO NOTHING;

-- ── Services (200) ────────────────────────────────────────────────────────────
INSERT INTO services (id, name, slug, description, active)
SELECT gen_random_uuid(),
       'Dịch vụ y tế ' || i || ' - ' || md5(random()::text),
       'dv-' || i || '-' || md5(random()::text),
       'Dịch vụ khám, tư vấn và điều trị chuyên sâu, trang bị thiết bị hiện đại.',
       (i % 25 <> 0)
FROM generate_series(1, 200) AS i
ON CONFLICT (slug) DO NOTHING;

-- ── Packages (100) ────────────────────────────────────────────────────────────
INSERT INTO packages (id, name, slug, description, price, active)
SELECT gen_random_uuid(),
       'Gói khám sức khỏe cấp ' || c || ' #' || i,
       'goi-' || i || '-' || md5(random()::text),
       'Gói khám toàn diện bao gồm xét nghiệm, chẩn đoán hình ảnh và tư vấn chuyên sâu.',
       (500000 + (i * 12345))::numeric(12,2),
       (i % 20 <> 0)
FROM generate_series(1, 100) AS i,
     LATERAL (SELECT chr(64 + 1 + (i % 3)) AS c) AS lvl
ON CONFLICT (slug) DO NOTHING;

-- ── Articles (500) ────────────────────────────────────────────────────────────
INSERT INTO articles (id, title, slug, summary, body, published_at, active)
SELECT gen_random_uuid(),
       'Bài viết y khoa số ' || i || ': ' || md5(random()::text),
       'bv-' || i || '-' || md5(random()::text),
       'Tóm tắt nội dung y khoa hữu ích cho bệnh nhân và người nhà.',
       'Nội dung chi tiết về phòng bệnh, sớm nhận biết triệu chứng và khi nào nên đi khám bác sĩ chuyên khoa.',
       now() - ((i % 180) || ' days')::interval,
       (i % 15 <> 0)
FROM generate_series(1, 500) AS i
ON CONFLICT (slug) DO NOTHING;

-- ── FAQs (150) ────────────────────────────────────────────────────────────────
INSERT INTO faqs (id, question, answer, active)
SELECT gen_random_uuid(),
       'Câu hỏi thường gặp số ' || i || ': làm thế nào để được hỗ trợ y tế phù hợp?',
       'Bệnh viện hỗ trợ qua nhiều kênh: đặt lịch trực tuyến, gọi điện thoại hoặc đến trực tiếp quầy lễ tân.',
       (i % 30 <> 0)
FROM generate_series(1, 150) AS i
ON CONFLICT DO NOTHING;

-- ── Doctor ↔ Specialty (avg 2-3 per doctor ≈ 1250) ───────────────────────────
INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT gen_random_uuid(), d.id, s.id
FROM doctors d
JOIN LATERAL (
    SELECT id FROM specialties
    ORDER BY random()
    LIMIT 2 + (abs(hashtext(d.id::text)) % 2)
) s ON true
ON CONFLICT (doctor_id, specialty_id) DO NOTHING;

-- ── Doctor ↔ Branch (avg 1-2 per doctor ≈ 750) ───────────────────────────────
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT gen_random_uuid(), d.id, b.id
FROM doctors d
JOIN LATERAL (
    SELECT id FROM branches
    ORDER BY random()
    LIMIT 1 + (abs(hashtext(d.id::text)) % 2)
) b ON true
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

-- ── Users (1000) ──────────────────────────────────────────────────────────────
-- BCrypt hash of "LocalDev!Pass2026" — local dev only, never a real secret.
INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
SELECT gen_random_uuid(),
       'user' || i || '@healthcare.local',
       '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
       'Bệnh nhân ' || i,
       CASE WHEN (i % 50 = 0) THEN 'DISABLED' ELSE 'ACTIVE' END,
       now() - ((i % 365) || ' days')::interval,
       now()
FROM generate_series(1, 1000) AS i
ON CONFLICT (email) DO NOTHING;

-- Give each user the PATIENT role; every 10th also DOCTOR; every 50th also ADMIN.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'PATIENT'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'DOCTOR'
WHERE (abs(hashtext(u.id::text)) % 10 = 0)
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'ADMIN'
WHERE (abs(hashtext(u.id::text)) % 50 = 0)
ON CONFLICT DO NOTHING;

COMMIT;
