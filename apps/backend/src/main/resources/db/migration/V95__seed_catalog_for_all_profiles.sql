-- ==============================================================================
-- V95__seed_catalog_for_all_profiles.sql
--
-- The StandaloneDataSeeder only runs under the "standalone" profile, so the
-- regular PostgreSQL profiles (local, render, render-beta) previously booted
-- with an empty catalog: no branches, no specialties, no services, no packages,
-- and the six canonical doctors from V53 without branch links or schedules.
-- V61/V61's and V67's cross joins silently produced zero rows for the same
-- reason, and V82's doctor-specialty reconciliation re-inserted nothing.
--
-- This migration applies the seeder-identical fictional catalog to every
-- profile. Every insert is guarded:
--   * catalog rows  -> ON CONFLICT (slug) DO NOTHING
--   * link rows     -> NOT EXISTS on the natural pair
--   * schedule rows -> NOT EXISTS on (doctor, branch, weekday, start time)
-- so content an operator already created through the admin screens (or the
-- fixture data applied to the local database) is never overwritten.
--
-- All names, bios and phone numbers below are FICTIONAL sample data, identical
-- to StandaloneDataSeeder. They do not represent real facilities or people.
-- ==============================================================================

-- 1. Branches (StandaloneDataSeeder.seedBranches) -----------------------------
INSERT INTO branches (id, name, slug, address, phone, working_hours, emergency_hotline, map_url, amenities, active)
VALUES
    ('95000000-0000-0000-0002-000000000001',
     'Bệnh viện Đa khoa An Tâm – Trung tâm',
     'benh-vien-an-tam-trung-tam',
     '128 Nguyễn Văn Cừ, Phường Chợ Quán, TP. Hồ Chí Minh',
     '028 3838 1288', '06:30–20:00, thứ Hai–Chủ nhật', '028 3838 1155',
     'https://www.google.com/maps/search/?api=1&query=128+Nguyen+Van+Cu+Ho+Chi+Minh',
     '["Cấp cứu 24/7", "Nhà thuốc", "Bãi đỗ xe", "Wi-Fi miễn phí"]'::jsonb, true),
    ('95000000-0000-0000-0002-000000000002',
     'Phòng khám An Tâm – Thảo Điền',
     'phong-kham-an-tam-thao-dien',
     '45 Võ Nguyên Giáp, Phường Thảo Điền, TP. Hồ Chí Minh',
     '028 3744 2233', '07:00–19:00, thứ Hai–Chủ nhật', '028 3744 2200',
     'https://www.google.com/maps/search/?api=1&query=45+Vo+Nguyen+Giap+Thao+Dien+Ho+Chi+Minh',
     '["Khám theo hẹn", "Khu lấy mẫu", "Tư vấn bảo hiểm", "Bãi đỗ xe"]'::jsonb, true),
    ('95000000-0000-0000-0002-000000000003',
     'Phòng khám An Tâm – Phú Nhuận',
     'phong-kham-an-tam-phu-nhuan',
     '202 Hoàng Văn Thụ, Phường Đức Nhuận, TP. Hồ Chí Minh',
     '028 3997 2020', '07:00–18:30, thứ Hai–thứ Bảy', '028 3997 2000',
     'https://www.google.com/maps/search/?api=1&query=202+Hoang+Van+Thu+Phu+Nhuan+Ho+Chi+Minh',
     '["Khám trong ngày", "Xét nghiệm", "Siêu âm", "Quầy thuốc"]'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Specialties (StandaloneDataSeeder.seedSpecialties). Locally these slugs
-- already exist from the fixture, so only a fresh profile receives them here.
INSERT INTO specialties (id, name, slug, description, common_symptoms, preparation_steps, care_pathway, active)
VALUES
    ('95000000-0000-0000-0003-000000000001', 'Tim mạch', 'tim-mach',
     'Khám, tầm soát và theo dõi các bệnh lý tim, mạch máu và huyết áp.',
     '["Đau tức ngực", "Khó thở khi gắng sức", "Hồi hộp hoặc đánh trống ngực"]'::jsonb,
     '["Mang theo kết quả đo huyết áp gần đây", "Chuẩn bị danh sách thuốc đang dùng", "Không tự ý ngưng thuốc trước khi khám"]'::jsonb,
     'Tiếp nhận → khám chuyên khoa → chỉ định cận lâm sàng → tư vấn kế hoạch theo dõi.', true),
    ('95000000-0000-0000-0003-000000000002', 'Nội tổng hợp', 'noi-tong-hop',
     'Khám tổng quát, sàng lọc nguy cơ và quản lý các bệnh mạn tính thường gặp.',
     '["Mệt mỏi kéo dài", "Chỉ số đường huyết bất thường", "Sụt hoặc tăng cân không rõ nguyên nhân"]'::jsonb,
     '["Mang theo kết quả xét nghiệm cũ", "Liệt kê bệnh nền", "Hỏi trước nếu cần nhịn ăn"]'::jsonb,
     'Đánh giá nguy cơ → xét nghiệm phù hợp → tư vấn điều trị → hẹn theo dõi.', true),
    ('95000000-0000-0000-0003-000000000003', 'Nhi khoa', 'nhi-khoa',
     'Chăm sóc sức khỏe trẻ em, theo dõi tăng trưởng và điều trị bệnh lý nhi khoa.',
     '["Sốt hoặc ho kéo dài", "Biếng ăn", "Rối loạn tiêu hóa"]'::jsonb,
     '["Mang sổ tiêm chủng", "Ghi lại thuốc trẻ đã dùng", "Cho trẻ mặc trang phục thoải mái"]'::jsonb,
     'Tiếp nhận trẻ → đánh giá tăng trưởng → khám nhi → hướng dẫn chăm sóc và tái khám.', true),
    ('95000000-0000-0000-0003-000000000004', 'Sản phụ khoa', 'san-phu-khoa',
     'Khám phụ khoa, chăm sóc thai kỳ, tư vấn sức khỏe sinh sản và tầm soát định kỳ.',
     '["Rối loạn chu kỳ", "Đau bụng dưới", "Cần tư vấn trước và trong thai kỳ"]'::jsonb,
     '["Ghi lại ngày đầu kỳ kinh gần nhất", "Mang kết quả siêu âm cũ", "Thông báo nếu đang mang thai"]'::jsonb,
     'Tư vấn ban đầu → khám và siêu âm khi cần → đọc kết quả → lập lịch theo dõi.', true),
    ('95000000-0000-0000-0003-000000000005', 'Tiêu hóa', 'tieu-hoa',
     'Khám và điều trị các vấn đề dạ dày, đại tràng, gan, mật và dinh dưỡng tiêu hóa.',
     '["Đau bụng tái diễn", "Đầy hơi hoặc khó tiêu", "Thay đổi thói quen đại tiện"]'::jsonb,
     '["Ghi lại thực phẩm gây khó chịu", "Mang theo kết quả nội soi", "Hỏi trước nếu cần nhịn ăn"]'::jsonb,
     'Khám lâm sàng → xét nghiệm hoặc nội soi → tư vấn dinh dưỡng và điều trị.', true),
    ('95000000-0000-0000-0003-000000000006', 'Cơ xương khớp', 'co-xuong-khop',
     'Đánh giá và điều trị đau khớp, thoái hóa cột sống, chấn thương và hạn chế vận động.',
     '["Đau hoặc cứng khớp", "Hạn chế vận động", "Đau lưng hoặc cổ kéo dài"]'::jsonb,
     '["Mặc trang phục thuận tiện vận động", "Mang phim chụp nếu có", "Ghi lại thuốc giảm đau đã dùng"]'::jsonb,
     'Đánh giá vận động → chẩn đoán hình ảnh khi cần → điều trị và phục hồi chức năng.', true),
    ('95000000-0000-0000-0003-000000000007', 'Thần kinh', 'than-kinh',
     'Khám đau đầu, chóng mặt, rối loạn giấc ngủ và các bệnh lý thần kinh thường gặp.',
     '["Đau đầu kéo dài", "Chóng mặt", "Tê hoặc yếu tay chân"]'::jsonb,
     '["Ghi lại thời điểm xuất hiện triệu chứng", "Mang phim hoặc kết quả cũ", "Nghỉ ngơi trước buổi khám"]'::jsonb,
     'Khai thác triệu chứng → khám thần kinh → cận lâm sàng khi cần → hẹn theo dõi.', true),
    ('95000000-0000-0000-0003-000000000008', 'Tai mũi họng', 'tai-mui-hong',
     'Khám và điều trị bệnh lý tai, mũi, họng cho trẻ em và người lớn.',
     '["Nghẹt mũi kéo dài", "Đau họng", "Ù tai hoặc nghe kém"]'::jsonb,
     '["Ghi lại thời gian khởi phát", "Mang thuốc đang sử dụng", "Không tự nhỏ thuốc trước khi khám"]'::jsonb,
     'Khám chuyên khoa → nội soi hoặc đo chức năng khi cần → hướng dẫn điều trị.', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. The two seeder doctors that no migration created yet (V53 covers the
-- other six with richer clinical biographies; never rewrite those bios here).
INSERT INTO doctors (id, full_name, slug, bio, active)
VALUES
    ('95000000-0000-0000-0004-000000000001',
     'BS.CKI Nguyễn Ngọc Lan', 'nguyen-ngoc-lan',
     'DỮ LIỆU MINH HỌA: 13 năm kinh nghiệm khám tổng quát và quản lý bệnh mạn tính.', true),
    ('95000000-0000-0000-0004-000000000002',
     'BS Trương Gia Bảo', 'truong-gia-bao',
     'DỮ LIỆU MINH HỌA: 9 năm kinh nghiệm khám và điều trị các bệnh lý tai mũi họng.', true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Doctor-specialty links. The six canonical mappings replicate V82, which
-- produced zero rows on profiles where the specialties table was still empty.
INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT v.id::uuid, d.id, s.id
FROM (VALUES
    ('95000000-0000-0000-0006-000000000001', 'nguyen-minh-khoi', 'tim-mach'),
    ('95000000-0000-0000-0006-000000000002', 'vo-thi-mai', 'san-phu-khoa'),
    ('95000000-0000-0000-0006-000000000003', 'le-van-duc', 'tieu-hoa'),
    ('95000000-0000-0000-0006-000000000004', 'pham-hoang-yen', 'nhi-khoa'),
    ('95000000-0000-0000-0006-000000000005', 'tran-thu-ha', 'than-kinh'),
    ('95000000-0000-0000-0006-000000000006', 'do-quang-huy', 'co-xuong-khop'),
    ('95000000-0000-0000-0006-000000000007', 'nguyen-ngoc-lan', 'noi-tong-hop'),
    ('95000000-0000-0000-0006-000000000008', 'truong-gia-bao', 'tai-mui-hong')
) AS v(id, doctor_slug, specialty_slug)
JOIN doctors d ON d.slug = v.doctor_slug
JOIN specialties s ON s.slug = v.specialty_slug
WHERE NOT EXISTS (
    SELECT 1 FROM doctor_specialties ds
    WHERE ds.doctor_id = d.id AND ds.specialty_id = s.id
);

-- 5. Doctor-branch links, following the seeder's branch assignment.
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT v.id::uuid, d.id, b.id
FROM (VALUES
    ('95000000-0000-0000-0005-000000000001', 'nguyen-minh-khoi', 'benh-vien-an-tam-trung-tam'),
    ('95000000-0000-0000-0005-000000000002', 'tran-thu-ha', 'benh-vien-an-tam-trung-tam'),
    ('95000000-0000-0000-0005-000000000003', 'vo-thi-mai', 'benh-vien-an-tam-trung-tam'),
    ('95000000-0000-0000-0005-000000000004', 'truong-gia-bao', 'benh-vien-an-tam-trung-tam'),
    ('95000000-0000-0000-0005-000000000005', 'le-van-duc', 'phong-kham-an-tam-thao-dien'),
    ('95000000-0000-0000-0005-000000000006', 'pham-hoang-yen', 'phong-kham-an-tam-thao-dien'),
    ('95000000-0000-0000-0005-000000000007', 'do-quang-huy', 'phong-kham-an-tam-phu-nhuan'),
    ('95000000-0000-0000-0005-000000000008', 'nguyen-ngoc-lan', 'phong-kham-an-tam-phu-nhuan')
) AS v(id, doctor_slug, branch_slug)
JOIN doctors d ON d.slug = v.doctor_slug
JOIN branches b ON b.slug = v.branch_slug
WHERE NOT EXISTS (
    SELECT 1 FROM doctor_branches db
    WHERE db.doctor_id = d.id AND db.branch_id = b.id
);

-- 6. Schedules. V61 and V67 seeded shifts by joining doctor_branches, which was
-- empty on fresh profiles, so unbookable doctors were left behind. Heal every
-- active pair that has no shift at all, using the seeder's grid: Mon-Sat
-- 08:00-11:30 plus Mon-Fri 13:30-17:00, 30-minute slots. Deterministic md5
-- primary keys keep the statement idempotent.
INSERT INTO doctor_schedules
    (id, doctor_id, branch_id, day_of_week, start_time, end_time,
     slot_duration_minutes, effective_from, active)
SELECT md5('v95-shift:' || db.doctor_id::text || ':' || db.branch_id::text
           || ':' || day_num::text || ':' || shift.start_time::text)::uuid,
       db.doctor_id, db.branch_id, day_num, shift.start_time, shift.end_time,
       30, DATE '2026-01-01', true
FROM doctor_branches db
JOIN doctors d ON d.id = db.doctor_id AND d.active
JOIN branches b ON b.id = db.branch_id AND b.active
CROSS JOIN generate_series(1, 6) AS day_num
CROSS JOIN (VALUES (TIME '08:00', TIME '11:30'), (TIME '13:30', TIME '17:00'))
    AS shift(start_time, end_time)
WHERE (day_num < 6 OR shift.start_time = TIME '08:00')
  AND NOT EXISTS (
    SELECT 1 FROM doctor_schedules s
    WHERE s.doctor_id = db.doctor_id AND s.branch_id = db.branch_id
      AND s.day_of_week = day_num AND s.start_time = shift.start_time
  );

-- 7. Medical services (StandaloneDataSeeder.seedServices).
INSERT INTO services (id, name, slug, description, active)
VALUES
    ('95000000-0000-0000-0007-000000000001', 'Khám sức khỏe tổng quát', 'kham-suc-khoe-tong-quat',
     'Đánh giá sức khỏe toàn diện và tư vấn kế hoạch chăm sóc cá nhân.', true),
    ('95000000-0000-0000-0007-000000000002', 'Xét nghiệm và chẩn đoán', 'xet-nghiem-chan-doan',
     'Xét nghiệm máu, sinh hóa và các dịch vụ chẩn đoán theo chỉ định.', true),
    ('95000000-0000-0000-0007-000000000003', 'Chẩn đoán hình ảnh', 'chan-doan-hinh-anh',
     'Siêu âm, X-quang và các kỹ thuật hình ảnh hỗ trợ chẩn đoán.', true),
    ('95000000-0000-0000-0007-000000000004', 'Khám chuyên khoa', 'kham-chuyen-khoa',
     'Tư vấn trực tiếp với bác sĩ thuộc nhiều chuyên khoa tại các cơ sở.', true),
    ('95000000-0000-0000-0007-000000000005', 'Tiêm chủng', 'tiem-chung',
     'Tư vấn và tiêm chủng cho trẻ em, người lớn theo lịch khuyến nghị.', true),
    ('95000000-0000-0000-0007-000000000006', 'Theo dõi bệnh mạn tính', 'theo-doi-benh-man-tinh',
     'Quản lý liên tục huyết áp, tiểu đường, tim mạch và các bệnh mạn tính.', true)
ON CONFLICT (slug) DO NOTHING;

-- 8. Health packages (StandaloneDataSeeder.seedPackages).
INSERT INTO packages (id, name, slug, description, price, target_audience,
                      duration_days, checklist, preparation_steps, display_order, version, active)
VALUES
    ('95000000-0000-0000-0008-000000000001', 'Gói khám sức khỏe cơ bản', 'goi-kham-suc-khoe-co-ban',
     'Sàng lọc các chỉ số sức khỏe thiết yếu trong một buổi.', 1200000,
     'Người trưởng thành khám định kỳ', 1,
     '["Khám nội tổng quát", "Xét nghiệm máu cơ bản", "Siêu âm ổ bụng", "Điện tâm đồ"]'::jsonb,
     '["Mang theo giấy tờ tùy thân và kết quả khám gần nhất", "Nhịn ăn theo hướng dẫn nếu gói có xét nghiệm", "Có mặt trước giờ hẹn khoảng 15 phút"]'::jsonb,
     1, 0, true),
    ('95000000-0000-0000-0008-000000000002', 'Gói tầm soát tim mạch', 'goi-tam-soat-tim-mach',
     'Đánh giá nguy cơ tim mạch và tư vấn theo dõi chuyên sâu.', 1800000,
     'Người có yếu tố nguy cơ tim mạch', 1,
     '["Khám tim mạch", "Điện tâm đồ", "Siêu âm tim", "Xét nghiệm mỡ máu"]'::jsonb,
     '["Mang theo giấy tờ tùy thân và kết quả khám gần nhất", "Nhịn ăn theo hướng dẫn nếu gói có xét nghiệm", "Có mặt trước giờ hẹn khoảng 15 phút"]'::jsonb,
     2, 0, true),
    ('95000000-0000-0000-0008-000000000003', 'Gói sức khỏe phụ nữ', 'goi-suc-khoe-phu-nu',
     'Kiểm tra sức khỏe tổng quát kết hợp tầm soát phụ khoa.', 2100000,
     'Phụ nữ từ 18 tuổi', 1,
     '["Khám tổng quát", "Khám phụ khoa", "Siêu âm", "Xét nghiệm cơ bản"]'::jsonb,
     '["Mang theo giấy tờ tùy thân và kết quả khám gần nhất", "Nhịn ăn theo hướng dẫn nếu gói có xét nghiệm", "Có mặt trước giờ hẹn khoảng 15 phút"]'::jsonb,
     3, 0, true),
    ('95000000-0000-0000-0008-000000000004', 'Gói theo dõi sức khỏe trẻ em', 'goi-suc-khoe-tre-em',
     'Đánh giá tăng trưởng, dinh dưỡng và lịch tiêm chủng của trẻ.', 800000,
     'Trẻ em và gia đình', 1,
     '["Khám nhi", "Đánh giá tăng trưởng", "Tư vấn dinh dưỡng", "Rà soát tiêm chủng"]'::jsonb,
     '["Mang theo giấy tờ tùy thân và kết quả khám gần nhất", "Nhịn ăn theo hướng dẫn nếu gói có xét nghiệm", "Có mặt trước giờ hẹn khoảng 15 phút"]'::jsonb,
     4, 0, true)
ON CONFLICT (slug) DO NOTHING;
