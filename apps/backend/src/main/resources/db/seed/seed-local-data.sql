-- ==============================================================================
-- Seed data for local development: original fictional hospital content.
-- All names, addresses, and content are invented; nothing is copied from any
-- real hospital brand. Safe to run repeatedly: upserts are idempotent by slug.
-- ==============================================================================

-- ── Specialties ───────────────────────────────────────────────────────────────
INSERT INTO specialties (id, name, slug, description, active) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Tim mạch', 'tim-mach', 'Khám và điều trị các bệnh lý về tim, mạch máu, tăng huyết áp.', true),
    ('10000000-0000-0000-0000-000000000002', 'Thần kinh', 'than-kinh', 'Khám và điều trị đau đầu, đau nửa đầu, rối loạn giấc ngủ, các bệnh lý thần kinh.', true),
    ('10000000-0000-0000-0000-000000000003', 'Tiêu hóa', 'tieu-hoa', 'Khám và điều trị các bệnh lý dạ dày, đại tràng, gan mật.', true),
    ('10000000-0000-0000-0000-000000000004', 'Nội tổng hợp', 'noi-tong-hop', 'Khám sàng lọc, quản lý bệnh mãn tính như tiểu đường, mỡ máu.', true),
    ('10000000-0000-0000-0000-000000000005', 'Nhi khoa', 'nhi-khoa', 'Khám và điều trị các bệnh lý trẻ em từ sơ sinh đến 16 tuổi.', true),
    ('10000000-0000-0000-0000-000000000006', 'Sản phụ khoa', 'san-phu-khoa', 'Khám thai định kỳ, tầm soát ung thư phụ khoa, tư vấn sinh sản.', true),
    ('10000000-0000-0000-0000-000000000007', 'Cơ xương khớp', 'co-xuong-khop', 'Khám và điều trị đau khớp, thoái hóa cột sống, loãng xương.', true),
    ('10000000-0000-0000-0000-000000000008', 'Tai mũi họng', 'tai-mui-hong', 'Khám và điều trị viêm họng, viêm xoang, rối loạn tiền đình.', true)
ON CONFLICT (slug) DO NOTHING;

-- ── Branches (facilities) ─────────────────────────────────────────────────────
INSERT INTO branches (id, name, slug, address, phone, active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Bệnh viện Đa khoa Sài Gòn Xanh', 'benh-vien-sai-gon-xanh', 'Số 128 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh', '028 3838 1288', true),
    ('20000000-0000-0000-0000-000000000002', 'Phòng khám Đa khoa Thảo Điền', 'phong-kham-thao-dien', 'Số 45 Xa lộ Hà Nội, Phường Thảo Điền, TP. Thủ Đức', '028 3744 2233', true)
ON CONFLICT (slug) DO NOTHING;

-- ── Doctors ───────────────────────────────────────────────────────────────────
INSERT INTO doctors (id, full_name, slug, bio, photo_url, active) VALUES
    ('30000000-0000-0000-0000-000000000001', 'TS.BS Nguyễn Minh Khôi', 'nguyen-minh-khoi', 'Chuyên khoa tim mạch can thiệp, 18 năm kinh nghiệm điều trị bệnh mạch vành.', NULL, true),
    ('30000000-0000-0000-0000-000000000002', 'ThS.BS Trần Thu Hà', 'tran-thu-ha', 'Chuyên khoa thần kinh, 12 năm kinh nghiệm khám và điều trị đau đầu mãn tính.', NULL, true),
    ('30000000-0000-0000-0000-000000000003', 'BS.CKI Lê Văn Đức', 'le-van-duc', 'Chuyên khoa tiêu hóa – gan mật, 15 năm kinh nghiệm nội soi tiêu hóa.', NULL, true),
    ('30000000-0000-0000-0000-000000000004', 'ThS.BS Phạm Hoàng Yến', 'pham-hoang-yen', 'Chuyên khoa nhi, 10 năm kinh nghiệm khám và điều trị trẻ em.', NULL, true),
    ('30000000-0000-0000-0000-000000000005', 'BS.CKII Võ Thị Mai', 'vo-thi-mai', 'Chuyên khoa sản phụ khoa, 20 năm kinh nghiệm sản khoa và hiếm muộn.', NULL, true),
    ('30000000-0000-0000-0000-000000000006', 'ThS.BS Đỗ Quang Huy', 'do-quang-huy', 'Chuyên khoa cơ xương khớp, 11 năm kinh nghiệm điều trị thoái hóa khớp.', NULL, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Doctor ↔ Specialty links ──────────────────────────────────────────────────
INSERT INTO doctor_specialties (id, doctor_id, specialty_id) VALUES
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- ── Doctor ↔ Branch links ─────────────────────────────────────────────────────
INSERT INTO doctor_branches (id, doctor_id, branch_id) VALUES
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001')
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
INSERT INTO packages (id, name, slug, description, price, active) VALUES
    ('50000000-0000-0000-0000-000000000001', 'Gói khám sức khỏe cơ bản', 'goi-kham-co-ban', 'Khám tổng quát, xét nghiệm máu, siêu âm ổ bụng, điện tâm đồ.', 1200000, true),
    ('50000000-0000-0000-0000-000000000002', 'Gói khám tim mạch', 'goi-kham-tim-mach', 'Khám chuyên khoa tim mạch, điện tâm đồ, siêu âm tim, mỡ máu.', 1800000, true),
    ('50000000-0000-0000-0000-000000000003', 'Gói tầm soát tiểu đường', 'goi-tam-soat-tieu-duong', 'Đường huyết đói, HbA1c, chức năng thận, tư vấn dinh dưỡng.', 900000, true),
    ('50000000-0000-0000-0000-000000000004', 'Gói khám sức khỏe trẻ em', 'goi-kham-tre-em', 'Khám nhi tổng quát, đánh giá tăng trưởng, tư vấn dinh dưỡng.', 800000, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Articles (published, fictional) ───────────────────────────────────────────
INSERT INTO articles (id, title, slug, summary, body, published_at, active) VALUES
    ('60000000-0000-0000-0000-000000000001',
     '5 dấu hiệu cảnh báo bệnh tim mạch bạn không nên bỏ qua',
     'dau-hieu-canh-bao-benh-tim-mach',
     'Đau ngực, khó thở, mệt mỏi bất thường... những dấu hiệu tưởng chừng nhỏ có thể là tín hiệu của bệnh tim mạch.',
     'Bệnh tim mạch thường tiến triển âm thầm. Nếu bạn gặp các triệu chứng như đau tức ngực khi gắng sức, khó thở về đêm, phù chân không rõ nguyên nhân, hoặc mệt mỏi kéo dài, hãy đến cơ sở y tế để được khám và tầm soát sớm. Việc phát hiện sớm giúp việc điều trị hiệu quả hơn rất nhiều.',
     '2026-08-01T08:00:00+07:00', true),
    ('60000000-0000-0000-0000-000000000002',
     'Chế độ dinh dưỡng hợp lý cho người tăng huyết áp',
     'dinh-duong-hop-ly-nguoi-tang-huyet-ap',
     'Giảm muối, tăng rau xanh, hạn chế chất béo bão hòa là ba nguyên tắc vàng trong ăn uống cho người tăng huyết áp.',
     'Người tăng huyết áp nên duy trì lượng muối dưới 5g mỗi ngày, ưu tiên rau xanh và trái cây, hạn chế rượu bia và thức ăn chế biến sẵn. Kết hợp với vận động đều đặn và theo dõi huyết áp tại nhà theo hướng dẫn của bác sĩ.',
     '2026-08-05T09:30:00+07:00', true),
    ('60000000-0000-0000-0000-000000000003',
     'Trẻ biếng ăn: hiểu đúng để chăm đúng',
     'tre-bieng-an-hieu-dung-de-cham-dung',
     'Biếng ăn ở trẻ có nhiều nguyên nhân khác nhau, từ sinh lý đến tâm lý. Cha mẹ nên bình tĩnh tìm hiểu thay vì ép trẻ.',
     'Biếng ăn có thể do giai đoạn tăng trưởng chậm lại, do bệnh lý hoặc do thói quen ăn uống chưa đúng. Cha mẹ nên cho trẻ ăn đúng giờ, không ép trẻ, và đưa trẻ đi khám nếu tình trạng kéo dài kèm sụt cân.',
     '2026-08-10T10:00:00+07:00', true)
ON CONFLICT (slug) DO NOTHING;

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

-- ── Doctor schedules (Mon-Fri, morning + afternoon shifts) ────────────────────
INSERT INTO doctor_schedules (id, doctor_id, branch_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, effective_to, active)
SELECT gen_random_uuid(), d.id, b.id, shifts.dow, shifts.start_time::time, shifts.end_time::time, 30, '2026-08-01', NULL, true
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
