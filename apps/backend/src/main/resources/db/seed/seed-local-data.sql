-- ==============================================================================
-- Seed data for local development: original fictional hospital content.
-- All names, addresses, and content are invented; nothing is copied from any
-- real hospital brand. Safe to run repeatedly: upserts are idempotent by slug.
-- ==============================================================================

-- All three local demo accounts use password: LocalDemo!2026
-- These credentials belong only to the disposable local seed and must never be
-- reused in a shared or deployed environment.
INSERT INTO users (id, email, password_hash, display_name, status) VALUES
    ('90000000-0000-0000-0000-000000000001', 'admin@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Quản trị viên Local', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000002', 'doctor@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Bác sĩ Local', 'ACTIVE'),
    ('90000000-0000-0000-0000-000000000003', 'patient@healthcare.local', '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa', 'Bệnh nhân Local', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('admin@healthcare.local', 'ADMIN'),
    ('doctor@healthcare.local', 'DOCTOR'),
    ('patient@healthcare.local', 'PATIENT')
) AS demo_accounts(email, role_code)
JOIN users u ON u.email = demo_accounts.email
JOIN roles r ON r.code = demo_accounts.role_code
ON CONFLICT DO NOTHING;

-- ── Specialties ───────────────────────────────────────────────────────────────
INSERT INTO specialties (id, name, slug, description, common_symptoms, preparation_steps, care_pathway, active) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Tim mạch', 'tim-mach', 'Khám và điều trị các bệnh lý về tim, mạch máu, tăng huyết áp.', '["Đau tức ngực khi gắng sức","Khó thở","Hồi hộp, đánh trống ngực"]'::jsonb, '["Mang theo kết quả đo huyết áp gần đây","Liệt kê thuốc đang sử dụng","Không tự ý ngừng thuốc trước khi khám"]'::jsonb, 'Tiếp nhận → khám chuyên khoa → xét nghiệm hoặc chẩn đoán hình ảnh → tư vấn kế hoạch theo dõi.', true),
    ('10000000-0000-0000-0000-000000000002', 'Thần kinh', 'than-kinh', 'Khám và điều trị đau đầu, đau nửa đầu, rối loạn giấc ngủ, các bệnh lý thần kinh.', '["Đau đầu kéo dài","Chóng mặt","Rối loạn giấc ngủ"]'::jsonb, '["Ghi lại thời điểm và mức độ triệu chứng","Mang theo phim hoặc kết quả khám cũ","Nghỉ ngơi trước buổi khám"]'::jsonb, 'Khai thác triệu chứng → khám thần kinh → chỉ định cận lâm sàng khi cần → hẹn theo dõi.', true),
    ('10000000-0000-0000-0000-000000000003', 'Tiêu hóa', 'tieu-hoa', 'Khám và điều trị các bệnh lý dạ dày, đại tràng, gan mật.', '["Đau bụng tái diễn","Đầy hơi, khó tiêu","Thay đổi thói quen đại tiện"]'::jsonb, '["Ghi lại thực phẩm gây khó chịu","Hỏi trước nếu cần nhịn ăn","Mang theo đơn thuốc và kết quả nội soi"]'::jsonb, 'Khám lâm sàng → xét nghiệm hoặc nội soi → đọc kết quả → hướng dẫn dinh dưỡng và điều trị.', true),
    ('10000000-0000-0000-0000-000000000004', 'Nội tổng hợp', 'noi-tong-hop', 'Khám sàng lọc, quản lý bệnh mãn tính như tiểu đường, mỡ máu.', '["Mệt mỏi kéo dài","Khát nước nhiều","Chỉ số đường huyết bất thường"]'::jsonb, '["Nhịn ăn theo hướng dẫn nếu có xét nghiệm","Mang sổ theo dõi chỉ số tại nhà","Chuẩn bị danh sách bệnh nền"]'::jsonb, 'Đánh giá nguy cơ → xét nghiệm cơ bản → phân tầng bệnh → lập kế hoạch chăm sóc chủ động.', true),
    ('10000000-0000-0000-0000-000000000005', 'Nhi khoa', 'nhi-khoa', 'Khám và điều trị các bệnh lý trẻ em từ sơ sinh đến 16 tuổi.', '["Sốt hoặc ho kéo dài","Biếng ăn, sụt cân","Thay đổi giấc ngủ"]'::jsonb, '["Mang sổ tiêm chủng và cân nặng gần đây","Ghi lại thuốc đã dùng","Cho trẻ mặc trang phục dễ kiểm tra"]'::jsonb, 'Tiếp nhận trẻ → đánh giá tăng trưởng → khám nhi → tư vấn chăm sóc và lịch tái khám.', true),
    ('10000000-0000-0000-0000-000000000006', 'Sản phụ khoa', 'san-phu-khoa', 'Khám thai định kỳ, tầm soát ung thư phụ khoa, tư vấn sinh sản.', '["Đau bụng dưới bất thường","Rối loạn chu kỳ","Ra huyết bất thường"]'::jsonb, '["Ghi lại ngày đầu kỳ kinh gần nhất","Mang theo kết quả siêu âm cũ","Trao đổi trước nếu đang mang thai"]'::jsonb, 'Tư vấn ban đầu → khám và siêu âm khi cần → đọc kết quả → lịch theo dõi phù hợp.', true),
    ('10000000-0000-0000-0000-000000000007', 'Cơ xương khớp', 'co-xuong-khop', 'Khám và điều trị đau khớp, thoái hóa cột sống, loãng xương.', '["Đau hoặc cứng khớp","Hạn chế vận động","Đau tăng khi thay đổi thời tiết"]'::jsonb, '["Mặc trang phục thuận tiện vận động","Mang phim X-quang hoặc MRI nếu có","Ghi lại các thuốc giảm đau đã dùng"]'::jsonb, 'Đánh giá vận động → chẩn đoán hình ảnh khi cần → phục hồi chức năng → theo dõi tiến triển.', true),
    ('10000000-0000-0000-0000-000000000008', 'Tai mũi họng', 'tai-mui-hong', 'Khám và điều trị viêm họng, viêm xoang, rối loạn tiền đình.', '["Nghẹt mũi hoặc đau họng","Ù tai","Chóng mặt khi thay đổi tư thế"]'::jsonb, '["Ghi lại thời gian khởi phát","Mang theo thuốc xịt hoặc thuốc đang dùng","Hạn chế hút thuốc trước khi khám"]'::jsonb, 'Khám tai mũi họng → nội soi hoặc đo chức năng khi cần → hướng dẫn điều trị và vệ sinh.', true)
ON CONFLICT (slug) DO UPDATE SET
    common_symptoms = CASE WHEN specialties.common_symptoms = '[]'::jsonb THEN EXCLUDED.common_symptoms ELSE specialties.common_symptoms END,
    preparation_steps = CASE WHEN specialties.preparation_steps = '[]'::jsonb THEN EXCLUDED.preparation_steps ELSE specialties.preparation_steps END,
    care_pathway = COALESCE(specialties.care_pathway, EXCLUDED.care_pathway);

-- ── Branches (facilities) ─────────────────────────────────────────────────────
INSERT INTO branches (id, name, slug, address, phone, working_hours, emergency_hotline, map_url, amenities, active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Bệnh viện Đa khoa Sài Gòn Xanh', 'benh-vien-sai-gon-xanh', 'Số 128 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh', '028 3838 1288', '06:30–20:00, tất cả các ngày', '028 3838 1155', 'https://maps.google.com/?q=HealthCare+Sai+Gon+Xanh', '["Khu tiếp đón 24/7","Nhà thuốc","Bãi đỗ xe","Wi-Fi miễn phí"]'::jsonb, true),
    ('20000000-0000-0000-0000-000000000002', 'Phòng khám Đa khoa Thảo Điền', 'phong-kham-thao-dien', 'Số 45 Xa lộ Hà Nội, Phường Thảo Điền, TP. Thủ Đức', '028 3744 2233', '07:00–19:00, thứ Hai–Chủ nhật', '028 3744 2200', 'https://maps.google.com/?q=HealthCare+Thao+Dien', '["Quầy tiếp đón","Khu lấy mẫu","Tư vấn bảo hiểm","Wi-Fi miễn phí"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
    working_hours = COALESCE(branches.working_hours, EXCLUDED.working_hours),
    emergency_hotline = COALESCE(branches.emergency_hotline, EXCLUDED.emergency_hotline),
    map_url = COALESCE(branches.map_url, EXCLUDED.map_url),
    amenities = CASE WHEN branches.amenities = '[]'::jsonb THEN EXCLUDED.amenities ELSE branches.amenities END;

-- ── Doctors ───────────────────────────────────────────────────────────────────
INSERT INTO doctors (id, full_name, slug, bio, photo_url, active) VALUES
    ('30000000-0000-0000-0000-000000000001', 'TS.BS Nguyễn Minh Khôi', 'nguyen-minh-khoi', 'Tiến sĩ, Bác sĩ Nguyễn Minh Khôi là chuyên gia tim mạch can thiệp hàng đầu với hơn 18 năm cống hiến trong công tác khám, tầm soát và điều trị các bệnh lý tim mạch phức tạp. Tốt nghiệp Bác sĩ Đa khoa và Bác sĩ Nội trú xuất sắc tại ĐH Y Dược TP.HCM, bác sĩ hoàn thành Tiến sĩ Y khoa và tu nghiệp can thiệp tim mạch tại Viện Tim mạch Quốc gia Singapore (NHCS) và Bệnh viện Đa khoa Massachusetts (Hoa Kỳ). Đã thực hiện thành công hơn 4.500 ca can thiệp mạch vành PCI.', '/media/doctors/doctor-1.jpg', true),
    ('30000000-0000-0000-0000-000000000002', 'ThS.BS Trần Thu Hà', 'tran-thu-ha', 'Thạc sĩ, Bác sĩ Trần Thu Hà là chuyên gia Nội Thần kinh với hơn 12 năm kinh nghiệm trong chẩn đoán và điều trị các bệnh lý hệ thần kinh trung ương và ngoại biên. Bác sĩ tốt nghiệp ĐH Y Hà Nội, tu nghiệp chuyên sâu về Điện não đồ, Điện cơ và Đột quỵ não tại BV Bạch Mai và ĐH Chulalongkorn (Thái Lan), có thế mạnh trong điều trị đau nửa đầu, đau đầu căng thẳng mạn tính, rối loạn giấc ngủ và tiền đình.', '/media/doctors/doctor-5.jpg', true),
    ('30000000-0000-0000-0000-000000000003', 'BS.CKI Lê Văn Đức', 'le-van-duc', 'Bác sĩ Chuyên khoa I Lê Văn Đức có hơn 15 năm kinh nghiệm chuyên sâu trong Nội tiêu hóa – Gan mật và Nội soi can thiệp đường tiêu hóa. Bác sĩ tốt nghiệp ĐH Y Dược TP.HCM, tu nghiệp kỹ thuật nội soi phóng đại NBI và cắt tách niêm mạc ESD/EMR tầm soát ung thư sớm tại BV Đại học Quốc gia Seoul (Hàn Quốc), đã thực hiện an toàn trên 12.000 ca nội soi can thiệp không đau.', '/media/doctors/doctor-3.jpg', true),
    ('30000000-0000-0000-0000-000000000004', 'ThS.BS Phạm Hoàng Yến', 'pham-hoang-yen', 'Thạc sĩ, Bác sĩ Phạm Hoàng Yến là chuyên gia Nhi khoa tận tâm với hơn 10 năm kinh nghiệm chăm sóc sức khỏe toàn diện cho trẻ sơ sinh và trẻ nhỏ. Tốt nghiệp Thạc sĩ Nhi khoa tại ĐH Y Dược TP.HCM, đạt chứng chỉ Cấp cứu Nhi nâng cao (PALS) từ Hiệp hội Tim mạch Hoa Kỳ và Dinh dưỡng Nhi lâm sàng, từng công tác tại BV Nhi Đồng 1 chuyên sâu hô hấp, tiêu hóa và truyền nhiễm trẻ em.', '/media/doctors/doctor-4.jpg', true),
    ('30000000-0000-0000-0000-000000000005', 'BS.CKII Võ Thị Mai', 'vo-thi-mai', 'Bác sĩ Chuyên khoa II Võ Thị Mai là chuyên gia với hơn 20 năm đồng hành cùng sức khỏe phụ nữ. Bác sĩ tốt nghiệp ĐH Y Dược TP.HCM và ĐH Y Hà Nội, tu nghiệp Hỗ trợ sinh sản (ART) và Phẫu thuật nội soi phụ khoa tại Pháp và Singapore. Từng công tác chủ chốt tại BV Từ Dũ, chuyên sâu quản lý thai kỳ nguy cơ cao, vô sinh hiếm muộn và tầm soát sớm ung thư phụ khoa.', '/media/doctors/doctor-2.jpg', true),
    ('30000000-0000-0000-0000-000000000006', 'ThS.BS Đỗ Quang Huy', 'do-quang-huy', 'Thạc sĩ, Bác sĩ Đỗ Quang Huy là chuyên gia Chấn thương chỉnh hình và Cơ xương khớp với hơn 11 năm kinh nghiệm điều trị thoái hóa khớp, cột sống và chấn thương thể thao. Bác sĩ tốt nghiệp ĐH Y Dược TP.HCM, tu nghiệp phẫu thuật nội soi khớp tại Singapore (SGH), tiên phong ứng dụng liệu pháp tiêm huyết tương giàu tiểu cầu PRP và bảo tồn khớp tự nhiên.', '/media/doctors/doctor-6.jpg', true)
ON CONFLICT (slug) DO UPDATE SET
    bio = EXCLUDED.bio,
    photo_url = EXCLUDED.photo_url;

-- ── Doctor ↔ Specialty links ──────────────────────────────────────────────────
UPDATE doctors SET user_id = (SELECT id FROM users WHERE email = 'doctor@healthcare.local')
WHERE slug = 'nguyen-minh-khoi' AND user_id IS NULL;

-- Resolve the demo profile by its user identity. If an unrelated profile
-- already owns the demo phone, leave it untouched instead of rebinding it.
INSERT INTO patient_profiles (id, full_name, phone, email, user_id)
SELECT '90000000-0000-0000-0000-000000000004', 'Bệnh nhân Local', '0900000001', 'patient@healthcare.local', u.id
FROM users u
WHERE u.email = 'patient@healthcare.local'
  AND NOT EXISTS (SELECT 1 FROM patient_profiles p WHERE p.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM patient_profiles p WHERE p.phone = '0900000001')
ON CONFLICT DO NOTHING;

INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT md5(format('doctor-specialty:%s:%s', d.id, s.id))::uuid,
       d.id,
       s.id
FROM (VALUES
    ('nguyen-minh-khoi', 'tim-mach'),
    ('tran-thu-ha', 'than-kinh'),
    ('le-van-duc', 'tieu-hoa'),
    ('pham-hoang-yen', 'nhi-khoa'),
    ('vo-thi-mai', 'san-phu-khoa'),
    ('do-quang-huy', 'co-xuong-khop')
) AS links(doctor_slug, specialty_slug)
JOIN doctors d ON d.slug = links.doctor_slug
JOIN specialties s ON s.slug = links.specialty_slug
ON CONFLICT DO NOTHING;

-- ── Doctor ↔ Branch links ─────────────────────────────────────────────────────
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT md5(format('doctor-branch:%s:%s', d.id, b.id))::uuid, d.id, b.id
FROM (VALUES
    ('nguyen-minh-khoi', 'benh-vien-sai-gon-xanh'),
    ('tran-thu-ha', 'benh-vien-sai-gon-xanh'),
    ('le-van-duc', 'phong-kham-thao-dien'),
    ('pham-hoang-yen', 'phong-kham-thao-dien'),
    ('vo-thi-mai', 'benh-vien-sai-gon-xanh'),
    ('do-quang-huy', 'benh-vien-sai-gon-xanh')
) AS links(doctor_slug, branch_slug)
JOIN doctors d ON d.slug = links.doctor_slug
JOIN branches b ON b.slug = links.branch_slug
ON CONFLICT DO NOTHING;

-- ── Services ──────────────────────────────────────────────────────────────────
INSERT INTO services (id, name, slug, description, active) VALUES
    ('40000000-0000-0000-0000-000000000001', 'Khám tổng quát', 'kham-tong-quat', 'Khám lâm sàng, xét nghiệm cơ bản và tư vấn sức khỏe.', true),
    ('40000000-0000-0000-0000-000000000002', 'Siêu âm ổ bụng', 'sieu-am-o-bung', 'Siêu âm đánh giá gan, mật, tụy, thận và các tạng trong ổ bụng.', true),
    ('40000000-0000-0000-0000-000000000003', 'Xét nghiệm máu tổng quát', 'xet-nghiem-mau', 'Công thức máu, đường huyết, mỡ máu, chức năng gan thận.', true),
    ('40000000-0000-0000-0000-000000000004', 'Điện tâm đồ', 'dien-tam-do', 'Ghi và đánh giá hoạt động điện tim, phát hiện rối loạn nhịp.', true),
    ('40000000-0000-0000-0000-000000000005', 'Nội soi dạ dày', 'noi-soi-da-day', 'Nội soi gây mê kiểm tra dạ dày – thực quản – tá tràng.', true),
    ('40000000-0000-0000-0000-000000000006', 'Tiêm chủng', 'tiem-chung', 'Tiêm vắc-xin cho trẻ em và người lớn theo lịch khuyến cáo.', true)
ON CONFLICT (slug) DO NOTHING;

-- ── Health packages ───────────────────────────────────────────────────────────
INSERT INTO packages (id, name, slug, description, price, target_audience, duration_days, checklist, preparation_steps, active) VALUES
    ('50000000-0000-0000-0000-000000000001', 'Gói khám sức khỏe cơ bản', 'goi-kham-co-ban', 'Khám tổng quát, xét nghiệm máu, siêu âm ổ bụng, điện tâm đồ.', 1200000, 'Người trưởng thành cần kiểm tra sức khỏe định kỳ', 1, '["Khám nội tổng quát","Xét nghiệm máu cơ bản","Siêu âm ổ bụng","Điện tâm đồ"]'::jsonb, '["Nhịn ăn 8 giờ nếu có xét nghiệm mỡ máu","Mang theo giấy tờ tùy thân","Đến trước giờ hẹn 15 phút"]'::jsonb, true),
    ('50000000-0000-0000-0000-000000000002', 'Gói khám tim mạch', 'goi-kham-tim-mach', 'Khám chuyên khoa tim mạch, điện tâm đồ, siêu âm tim, mỡ máu.', 1800000, 'Người có yếu tố nguy cơ tim mạch hoặc tiền sử gia đình', 1, '["Khám tim mạch","Điện tâm đồ","Siêu âm tim","Xét nghiệm mỡ máu"]'::jsonb, '["Mang sổ theo dõi huyết áp","Liệt kê thuốc đang dùng","Tránh vận động gắng sức trước khi đo"]'::jsonb, true),
    ('50000000-0000-0000-0000-000000000003', 'Gói tầm soát tiểu đường', 'goi-tam-soat-tieu-duong', 'Đường huyết đói, HbA1c, chức năng thận, tư vấn dinh dưỡng.', 900000, 'Người thừa cân, có tiền sử gia đình hoặc chỉ số đường huyết cao', 1, '["Đường huyết đói","HbA1c","Chức năng thận","Tư vấn dinh dưỡng"]'::jsonb, '["Nhịn ăn qua đêm theo hướng dẫn","Uống nước lọc vừa đủ","Không tự ý đổi thuốc trước buổi khám"]'::jsonb, true),
    ('50000000-0000-0000-0000-000000000004', 'Gói khám sức khỏe trẻ em', 'goi-kham-tre-em', 'Khám nhi tổng quát, đánh giá tăng trưởng, tư vấn dinh dưỡng.', 800000, 'Trẻ em cần theo dõi tăng trưởng và sức khỏe định kỳ', 1, '["Khám nhi tổng quát","Đánh giá chiều cao và cân nặng","Tư vấn dinh dưỡng","Rà soát lịch tiêm chủng"]'::jsonb, '["Mang sổ tiêm chủng","Ghi lại triệu chứng và thuốc đã dùng","Cho trẻ mặc trang phục thoải mái"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
    target_audience = COALESCE(packages.target_audience, EXCLUDED.target_audience),
    duration_days = COALESCE(packages.duration_days, EXCLUDED.duration_days),
    checklist = CASE WHEN packages.checklist = '[]'::jsonb THEN EXCLUDED.checklist ELSE packages.checklist END,
    preparation_steps = CASE WHEN packages.preparation_steps = '[]'::jsonb THEN EXCLUDED.preparation_steps ELSE packages.preparation_steps END;

-- ── Articles (published, fictional) ───────────────────────────────────────────
INSERT INTO articles (id, title, slug, summary, body, published_at, category, author_name, reading_minutes, related_specialty_slug, sections, active) VALUES
    ('60000000-0000-0000-0000-000000000001',
     '5 dấu hiệu cảnh báo bệnh tim mạch bạn không nên bỏ qua',
     'dau-hieu-canh-bao-benh-tim-mach',
     'Đau ngực, khó thở, mệt mỏi bất thường... những dấu hiệu tưởng chừng nhỏ có thể là tín hiệu của bệnh tim mạch.',
     'Bệnh tim mạch thường tiến triển âm thầm. Nếu bạn gặp các triệu chứng như đau tức ngực khi gắng sức, khó thở về đêm, phù chân không rõ nguyên nhân, hoặc mệt mỏi kéo dài, hãy đến cơ sở y tế để được khám và tầm soát sớm. Việc phát hiện sớm giúp việc điều trị hiệu quả hơn rất nhiều.',
     '2026-08-01T08:00:00+07:00', 'Phòng bệnh chủ động', 'Đội ngũ chuyên môn', 5, 'tim-mach', '[{"heading":"Nhận biết sớm","body":"Đau tức ngực, khó thở và mệt mỏi bất thường cần được đánh giá trong bối cảnh cụ thể, đặc biệt khi triệu chứng xuất hiện khi gắng sức."},{"heading":"Khi nào nên đi khám","body":"Nếu triệu chứng tăng nhanh, kéo dài hoặc đi kèm vã mồ hôi, choáng, hãy tìm hỗ trợ y tế ngay."}]'::jsonb, true),
    ('60000000-0000-0000-0000-000000000002',
     'Chế độ dinh dưỡng hợp lý cho người tăng huyết áp',
     'dinh-duong-hop-ly-nguoi-tang-huyet-ap',
     'Giảm muối, tăng rau xanh, hạn chế chất béo bão hòa là ba nguyên tắc vàng trong ăn uống cho người tăng huyết áp.',
     'Người tăng huyết áp nên duy trì lượng muối dưới 5g mỗi ngày, ưu tiên rau xanh và trái cây, hạn chế rượu bia và thức ăn chế biến sẵn. Kết hợp với vận động đều đặn và theo dõi huyết áp tại nhà theo hướng dẫn của bác sĩ.',
     '2026-08-05T09:30:00+07:00', 'Dinh dưỡng', 'Đội ngũ dinh dưỡng', 4, 'tim-mach', '[{"heading":"Giảm muối từ thói quen nhỏ","body":"Ưu tiên thực phẩm tươi, đọc nhãn dinh dưỡng và nêm nếm vừa phải giúp kiểm soát lượng muối mỗi ngày."},{"heading":"Theo dõi đều đặn","body":"Kết hợp chế độ ăn với vận động phù hợp và ghi lại huyết áp theo hướng dẫn của nhân viên y tế."}]'::jsonb, true),
    ('60000000-0000-0000-0000-000000000003',
     'Trẻ biếng ăn: hiểu đúng để chăm đúng',
     'tre-bieng-an-hieu-dung-de-cham-dung',
     'Biếng ăn ở trẻ có nhiều nguyên nhân khác nhau, từ sinh lý đến tâm lý. Cha mẹ nên bình tĩnh tìm hiểu thay vì ép trẻ.',
     'Biếng ăn có thể do giai đoạn tăng trưởng chậm lại, do bệnh lý hoặc do thói quen ăn uống chưa đúng. Cha mẹ nên cho trẻ ăn đúng giờ, không ép trẻ, và đưa trẻ đi khám nếu tình trạng kéo dài kèm sụt cân.',
     '2026-08-10T10:00:00+07:00', 'Sức khỏe gia đình', 'Đội ngũ nhi khoa', 4, 'nhi-khoa', '[{"heading":"Tìm nguyên nhân","body":"Biếng ăn có thể liên quan đến giai đoạn phát triển, bệnh lý hoặc thói quen sinh hoạt; nên quan sát cả tăng trưởng và tinh thần của trẻ."},{"heading":"Khi cần tư vấn","body":"Đưa trẻ đi khám nếu biếng ăn kéo dài, sụt cân hoặc xuất hiện triệu chứng bất thường khác."}]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
    category = COALESCE(articles.category, EXCLUDED.category),
    author_name = COALESCE(articles.author_name, EXCLUDED.author_name),
    reading_minutes = COALESCE(articles.reading_minutes, EXCLUDED.reading_minutes),
    related_specialty_slug = COALESCE(articles.related_specialty_slug, EXCLUDED.related_specialty_slug),
    sections = CASE WHEN articles.sections = '[]'::jsonb THEN EXCLUDED.sections ELSE articles.sections END;

-- ── FAQs ──────────────────────────────────────────────────────────────────────
INSERT INTO faqs (id, question, answer, active) VALUES
    ('70000000-0000-0000-0000-000000000001', 'Làm thế nào để đặt lịch khám?', 'Bạn có thể đặt lịch qua website, gọi điện thoại hoặc đến trực tiếp quầy lễ tân của bệnh viện.', true),
    ('70000000-0000-0000-0000-000000000002', 'Bệnh viện có nhận bảo hiểm y tế không?', 'Có, bệnh viện tiếp nhận bảo hiểm y tế theo quy định của Bộ Y tế và bảo hiểm bảo lãnh theo chương trình hợp tác.', true),
    ('70000000-0000-0000-0000-000000000003', 'Tôi cần nhịn ăn trước khi xét nghiệm máu không?', 'Với xét nghiệm đường huyết và mỡ máu, bạn nên nhịn ăn ít nhất 8 giờ. Hãy hỏi lễ tân hoặc bác sĩ trước khi làm thủ tục.', true),
    ('70000000-0000-0000-0000-000000000004', 'Giờ khám bệnh là khi nào?', 'Bệnh viện khám từ 6h30 đến 20h00 tất cả các ngày trong tuần, kể cả ngày lễ.', true)
ON CONFLICT DO NOTHING;

-- ── CMS content (published fictional frontend component) ─────────────────────
-- This seed is intentionally payload-only: no HTML, JavaScript, CSS, secrets,
-- or patient data. Re-running it preserves an admin's later edits by slot key.
INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
) VALUES (
    '80000000-0000-0000-0000-000000000001',
    'homepage.hero',
    'HERO',
    '{"eyebrow":"Chăm sóc chủ động","title":"Đồng hành cùng sức khỏe gia đình","body":"Đặt lịch khám và tìm hiểu dịch vụ chăm sóc phù hợp với nhu cầu của bạn.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED',
    1,
    '2026-08-01T08:00:00+07:00',
    '2026-08-01T08:00:00+07:00'
)
ON CONFLICT (slot_key) DO NOTHING;

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
) VALUES
(
    '80000000-0000-0000-0000-000000000002',
    'careers.hero',
    'HERO',
    '{"eyebrow":"Cơ hội nghề nghiệp tại HealthCare","title":"Cùng chăm sóc người bệnh bằng năng lực và sự tử tế","body":"Khám phá môi trường làm việc đề cao an toàn, phối hợp liên chuyên môn và sự phát triển bền vững của mỗi thành viên.","ctaLabel":"Xem vị trí đang tuyển","ctaHref":"/careers#vi-tri-dang-tuyen"}'::jsonb,
    'PUBLISHED',
    1,
    '2026-08-01T08:00:00+07:00',
    '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000003',
    'careers.body',
    'RICH_TEXT',
    '{"title":"Điều chúng tôi mong đợi ở đồng đội","body":"Chúng tôi trân trọng tinh thần học hỏi, giao tiếp rõ ràng và cam kết đặt an toàn của người bệnh lên hàng đầu trong mọi vai trò."}'::jsonb,
    'PUBLISHED',
    1,
    '2026-08-01T08:00:00+07:00',
    '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000004',
    'search.hero',
    'HERO',
    '{"eyebrow":"Danh mục đã xuất bản","title":"Tìm kiếm theo thông tin bệnh viện","body":"Kết quả bên dưới được lọc trực tiếp từ chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang của HealthCare."}'::jsonb,
    'PUBLISHED',
    1,
    '2026-08-01T08:00:00+07:00',
    '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000005',
    'homepage.body',
    'RICH_TEXT',
    '{"title":"Hành trình chăm sóc được cập nhật","body":"Thông tin mới từ bệnh viện sẽ xuất hiện tại đây sau khi được xuất bản. Dữ liệu chuyên khoa, bác sĩ và cơ sở luôn được cập nhật theo danh mục hiện tại."}'::jsonb,
    'PUBLISHED',
    1,
    '2026-08-01T08:00:00+07:00',
    '2026-08-01T08:00:00+07:00'
)
ON CONFLICT (slot_key) DO NOTHING;

-- The local seed runs after the backend is already healthy in Compose. Direct
-- SQL inserts cannot publish an in-process application event, so persist one
-- durable public cursor row per seeded CMS slot. Connected frontend sessions
-- can then reconcile through SSE replay or heartbeat without relying on a
-- transient Java event from this one-shot seed container.
INSERT INTO cms_content_changes (
    content_id,
    slot_key,
    content_version,
    published,
    changed_at,
    actor_email,
    component_type,
    status,
    payload,
    previous_payload,
    public_event
)
SELECT
    content.id,
    content.slot_key,
    content.version,
    TRUE,
    content.updated_at,
    'seed@healthcare.local',
    content.component_type,
    content.status,
    content.payload,
    NULL,
    TRUE
FROM cms_contents content
WHERE content.id IN (
    '80000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000003',
    '80000000-0000-0000-0000-000000000004',
    '80000000-0000-0000-0000-000000000005'
)
  AND content.status = 'PUBLISHED'
  AND content.version = 1
  AND NOT EXISTS (
      SELECT 1
      FROM cms_content_changes existing_change
      WHERE existing_change.content_id = content.id
        AND existing_change.content_version = content.version
        AND existing_change.public_event = TRUE
  )
ORDER BY content.slot_key;

-- ── Public career openings ──────────────────────────────────────────────────
INSERT INTO job_positions (
    id, slug, title, department, location, employment_type, summary,
    responsibilities, requirements, benefits, featured, active
) VALUES
(
    '90000000-0000-0000-0000-000000000001', 'dieu-duong-da-khoa', 'Điều dưỡng đa khoa',
    'Khối Điều dưỡng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
    'Phối hợp cùng bác sĩ và đội ngũ chăm sóc để hỗ trợ người bệnh trong suốt quá trình thăm khám, điều trị.',
    E'Tiếp nhận, theo dõi và thực hiện chăm sóc người bệnh theo phân công\nThực hiện đúng quy trình an toàn người bệnh và kiểm soát nhiễm khuẩn\nGhi nhận thông tin chăm sóc đầy đủ, phối hợp bàn giao giữa các ca',
    E'Tốt nghiệp Cao đẳng hoặc Đại học chuyên ngành Điều dưỡng\nCó giấy phép hành nghề phù hợp theo quy định hiện hành\nGiao tiếp rõ ràng, tôn trọng người bệnh và phối hợp nhóm tốt',
    E'Quy trình hội nhập và hướng dẫn công việc rõ ràng\nTham gia đào tạo chuyên môn theo kế hoạch của bệnh viện\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    true, true
),
(
    '90000000-0000-0000-0000-000000000002', 'ky-thuat-vien-xet-nghiem', 'Kỹ thuật viên xét nghiệm',
    'Khối Cận lâm sàng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
    'Thực hiện các bước tiếp nhận và xử lý mẫu xét nghiệm, góp phần bảo đảm kết quả chính xác và đúng thời gian.',
    E'Tiếp nhận, kiểm tra và xử lý mẫu theo quy trình chuyên môn\nVận hành thiết bị trong phạm vi được phân công và ghi nhận kiểm soát chất lượng\nPhối hợp trả kết quả và báo cáo các tình huống cần lưu ý',
    E'Tốt nghiệp chuyên ngành Kỹ thuật xét nghiệm y học\nCẩn trọng, có khả năng làm việc theo quy trình và theo ca\nƯu tiên ứng viên có giấy phép hành nghề phù hợp',
    E'Được hướng dẫn quy trình và hệ thống chất lượng khi nhận việc\nCơ hội học hỏi trong môi trường phối hợp đa chuyên khoa\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    false, true
),
(
    '90000000-0000-0000-0000-000000000003', 'chuyen-vien-cham-soc-khach-hang', 'Chuyên viên chăm sóc khách hàng',
    'Trải nghiệm người bệnh', 'Phòng khám An Tâm Thảo Điền', 'FULL_TIME',
    'Hướng dẫn người bệnh và thân nhân tiếp cận đúng dịch vụ, lịch khám và kênh hỗ trợ tại cơ sở.',
    E'Tiếp nhận nhu cầu, hướng dẫn thủ tục và điều phối thông tin tại quầy\nGiải đáp trong phạm vi được phân công, chuyển tiếp đúng bộ phận khi cần\nGhi nhận phản hồi để cải thiện trải nghiệm người bệnh',
    E'Tốt nghiệp Trung cấp, Cao đẳng hoặc Đại học\nGiọng nói rõ ràng, giao tiếp điềm tĩnh và chủ động\nCó thể sử dụng các công cụ văn phòng cơ bản',
    E'Được đào tạo về quy trình tiếp đón và bảo mật thông tin\nMôi trường làm việc phối hợp và tôn trọng\nChế độ làm việc và phúc lợi theo chính sách hiện hành',
    false, true
),
(
    '90000000-0000-0000-0000-000000000004', 'thuc-tap-sinh-hanh-chinh-nhan-su', 'Thực tập sinh Hành chính – Nhân sự',
    'Hành chính – Nhân sự', 'Văn phòng An Tâm Trung tâm', 'INTERNSHIP',
    'Hỗ trợ các công việc hành chính, lưu trữ và trải nghiệm nhân viên dưới sự hướng dẫn của phụ trách bộ phận.',
    E'Hỗ trợ chuẩn bị hồ sơ, biểu mẫu và sắp xếp tài liệu\nPhối hợp tổ chức hoạt động nội bộ theo kế hoạch\nCập nhật tiến độ công việc và bảo mật thông tin được tiếp cận',
    E'Sinh viên năm cuối các ngành Quản trị nhân lực, Hành chính hoặc ngành liên quan\nCẩn thận, đúng hẹn và sẵn sàng học hỏi\nSử dụng được các công cụ văn phòng cơ bản',
    E'Có người hướng dẫn trong thời gian thực tập\nĐược tiếp cận quy trình vận hành trong môi trường bệnh viện\nXác nhận thực tập theo quy định khi hoàn thành',
    false, true
)
ON CONFLICT (slug) DO NOTHING;

-- ── Doctor schedules (Mon-Fri, morning + afternoon shifts) ────────────────────
INSERT INTO doctor_schedules (id, doctor_id, branch_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, effective_to, active)
SELECT md5(format('schedule:%s:%s:%s:%s:%s', d.id, b.id, shifts.dow, shifts.start_time, shifts.end_time))::uuid,
       d.id, b.id, shifts.dow, shifts.start_time::time, shifts.end_time::time, 30, '2026-08-01', NULL, true
FROM doctors d
JOIN doctor_branches db ON db.doctor_id = d.id
JOIN branches b ON b.id = db.branch_id
CROSS JOIN (VALUES (1, '08:00:00', '11:30:00'), (2, '08:00:00', '11:30:00'), (3, '08:00:00', '11:30:00'), (4, '08:00:00', '11:30:00'), (5, '08:00:00', '11:30:00')) AS shifts(dow, start_time, end_time)
    WHERE NOT EXISTS (
    SELECT 1
    FROM doctor_schedules s
    WHERE s.doctor_id = d.id
      AND s.branch_id = db.branch_id
      AND s.day_of_week = shifts.dow
      AND s.start_time = shifts.start_time::time
      AND s.end_time = shifts.end_time::time
);
