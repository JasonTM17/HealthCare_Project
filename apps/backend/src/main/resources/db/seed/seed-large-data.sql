-- ==============================================================================
-- LARGE seed dataset for pagination / search / performance testing.
-- Original fictional hospital content only — nothing copied from any real brand.
--
-- Scale (approx): specialties 30, branches 20, doctors 500, services 200,
-- packages 100, articles 500, faqs 150, doctor_specialties 1500,
-- doctor_branches 750, doctor_schedules about 7500, users 1001 (1,000
-- synthetic users plus the deterministic local CMS admin fixture).
--
-- Idempotent: truncates domain tables (roles/permissions preserved) then
-- regenerates. Safe to re-run. Password hash is a BCrypt stub valid only for
-- local dev; never a real secret.
-- ==============================================================================

BEGIN;

TRUNCATE TABLE
    prescription_items,
    prescriptions,
    medical_records,
    diagnostic_results,
    refresh_tokens,
    user_roles,
    users,
    patient_profiles,
    appointments,
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
INSERT INTO specialties (id, name, slug, description, common_symptoms, preparation_steps, care_pathway, active)
SELECT md5('large-specialty:' || slug)::uuid, name, slug, description,
       jsonb_build_array('Triệu chứng liên quan đến ' || lower(name), 'Mệt mỏi kéo dài'),
       jsonb_build_array('Mang theo kết quả khám cũ nếu có', 'Ghi lại thuốc đang sử dụng'),
       'Tiếp nhận → khám chuyên khoa → cận lâm sàng khi cần → tư vấn theo dõi.',
       true
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
INSERT INTO branches (id, name, slug, address, phone, working_hours, emergency_hotline, map_url, amenities, active)
SELECT md5(format('large-branch:%s', s.idx))::uuid,
       'Bệnh viện Đa khoa Sài Gòn Xanh - Cơ sở ' || s.idx,
       'cs-' || s.idx,
       (s.idx || ' Đường số ' || (s.idx % 30 + 1) || ', Quận ' || (s.idx % 12 + 1) || ', TP. Hồ Chí Minh'),
       '028 ' || lpad((38000000 + s.idx)::text, 8, '0'),
       '06:30–20:00, tất cả các ngày',
       '028 1800 ' || lpad(s.idx::text, 4, '0'),
       'https://maps.google.com/?q=HealthCare+Branch+' || s.idx,
       jsonb_build_array('Quầy tiếp đón', 'Khu lấy mẫu', 'Wi-Fi miễn phí'),
       true
FROM generate_series(1, 20) AS s(idx)
ON CONFLICT (slug) DO NOTHING;

-- ── Doctors (500) ─────────────────────────────────────────────────────────────
-- photo_url stays NULL on purpose: the frontend renders a neutral initials
-- avatar for doctors without an own portrait instead of a shared photograph.
INSERT INTO doctors (id, full_name, slug, bio, photo_url, active)
SELECT md5(format('large-doctor:%s', gs.idx))::uuid,
       names.ho[1 + (gs.idx % 5)] || ' ' || names.dem[1 + ((gs.idx * 3) % 6)] || ' ' || names.ten[1 + ((gs.idx * 7) % 8)],
       'bs-' || gs.idx,
       'Bác sĩ chuyên khoa với ' || (8 + (gs.idx % 15)) || ' năm kinh nghiệm điều trị và chăm sóc bệnh nhân.',
       NULL,
       (gs.idx % 20 <> 0)  -- 5% inactive to exercise active filters
FROM generate_series(1, 500) AS gs(idx),
     LATERAL (SELECT ARRAY['Nguyễn','Trần','Lê','Phạm','Võ','Đỗ','Bùi','Hoàng','Đặng','Ngô'] AS ho,
                     ARRAY['Văn','Thị','Minh','Quốc','Hoàng','Thanh','Thu','Ngọc','Anh'] AS dem,
                     ARRAY['Khôi','Hà','Đức','Yến','Huy','Mai','Long','Trung','Lan','Phúc'] AS ten) AS names
ON CONFLICT (slug) DO NOTHING;

-- ── Services (200 = 10 service kinds × 20 clinical focuses) ───────────────────
-- Names are a deterministic cross product so every catalog row stays distinct
-- and reads like a real hospital service line item.
INSERT INTO services (id, name, slug, description, active)
SELECT md5(format('large-service:%s', i))::uuid,
       m.label || ' ' || f.name,
       'dv-' || i,
       f.name || ': ' || m.detail || ', thực hiện bởi đội ngũ chuyên khoa với quy trình chuẩn và thiết bị hiện đại.',
       (i % 25 <> 0)
FROM generate_series(1, 200) AS i
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('Khám chuyên khoa', 'đánh giá lâm sàng và tư vấn chuyên môn'),
        ('Siêu âm tầm soát', 'hình ảnh học không xâm lấn theo chuẩn quốc tế'),
        ('Xét nghiệm chẩn đoán', 'xét nghiệm cận lâm sàng phục vụ chẩn đoán'),
        ('Tầm soát định kỳ', 'phát hiện sớm yếu tố nguy cơ'),
        ('Tư vấn chuyên sâu', 'trao đổi kế hoạch chăm sóc cá nhân hóa'),
        ('Theo dõi và quản lý', 'theo dõi tiến triển và điều chỉnh điều trị'),
        ('Đánh giá nguy cơ', 'thang điểm và chỉ số dự phòng'),
        ('Phục hồi và chăm sóc', 'kế hoạch phục hồi sau điều trị'),
        ('Kiểm tra sức khỏe', 'bộ chỉ số nền tảng theo độ tuổi'),
        ('Tham vấn dinh dưỡng', 'chế độ ăn phù hợp tình trạng sức khỏe')
    ) AS t(label, detail)
    OFFSET (((i - 1) / 20) % 10) LIMIT 1
) m
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('tim mạch'), ('hô hấp'), ('tiêu hóa'), ('gan mật'), ('thận - tiết niệu'),
        ('đái tháo đường'), ('tuyến giáp'), ('thần kinh'), ('cơ xương khớp'), ('da liễu'),
        ('tai mũi họng'), ('mắt'), ('răng hàm mặt'), ('sản phụ khoa'), ('nhi khoa'),
        ('nam khoa'), ('dinh dưỡng'), ('huyết học'), ('ung bướu'), ('phục hồi chức năng')
    ) AS f(name)
    OFFSET ((i - 1) % 20) LIMIT 1
) f
ON CONFLICT (slug) DO NOTHING;

-- ── Packages (100 = 20 clinical focuses × 5 depth levels) ─────────────────────
INSERT INTO packages (id, name, slug, description, price, target_audience, duration_days, checklist, preparation_steps, active)
SELECT md5(format('large-package:%s', i))::uuid,
       'Gói ' || f.name || ' ' || d.level,
       'goi-' || i,
       'Gói ' || d.level || ' dành cho ' || f.name || ': kết hợp khám lâm sàng, xét nghiệm, chẩn đoán hình ảnh và tư vấn chuyên sâu.',
       (500000 + (i * 12345))::numeric(12,2),
       'Người trưởng thành cần kiểm tra và theo dõi ' || f.name || ' định kỳ',
       1 + (i % 3),
       jsonb_build_array('Khám lâm sàng', 'Xét nghiệm cơ bản', 'Tư vấn kết quả'),
       jsonb_build_array('Mang theo giấy tờ tùy thân', 'Đến trước giờ hẹn 15 phút'),
       (i % 20 <> 0)
FROM generate_series(1, 100) AS i
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('cơ bản'), ('nâng cao'), ('chuyên sâu'), ('toàn diện'), ('định kỳ')
    ) AS d(level)
    OFFSET ((i - 1) % 5) LIMIT 1
) d
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('tim mạch'), ('hô hấp'), ('tiêu hóa'), ('gan mật'), ('thận - tiết niệu'),
        ('đái tháo đường'), ('tuyến giáp'), ('thần kinh'), ('cơ xương khớp'), ('da liễu'),
        ('tai mũi họng'), ('mắt'), ('răng hàm mặt'), ('sản phụ khoa'), ('nhi khoa'),
        ('nam khoa'), ('dinh dưỡng'), ('huyết học'), ('ung bướu'), ('phục hồi chức năng')
    ) AS f(name)
    OFFSET (((i - 1) / 5) % 20) LIMIT 1
) f
ON CONFLICT (slug) DO NOTHING;

-- ── Articles (500 = 25 clinical topics × 20 editorial angles) ─────────────────
INSERT INTO articles (id, title, slug, summary, body, published_at, category, author_name, reading_minutes, related_specialty_slug, sections, active)
SELECT md5(format('large-article:%s', i))::uuid,
       a.angle || ' ' || t.topic,
       'bv-' || i,
       'Tổng quan y khoa về ' || t.topic || ': nhận biết sớm, phòng ngừa và khi nào nên gặp bác sĩ chuyên khoa.',
       'Bài viết được biên soạn bởi đội ngũ chuyên môn nhằm giúp người đọc hiểu rõ về ' || t.topic || ', nhận biết dấu hiệu bất thường và chọn thời điểm đi khám phù hợp. Nội dung chỉ mang tính tham khảo, không thay thế chẩn đoán trực tiếp.',
       TIMESTAMPTZ '2026-08-01T08:00:00+07:00' - ((i % 180) || ' days')::interval,
       t.category,
       'Đội ngũ chuyên môn',
       4 + (i % 6),
       t.slug,
       jsonb_build_array(
           jsonb_build_object('heading', 'Tổng quan', 'body', 'Thông tin được biên soạn để giúp người đọc nhận biết rủi ro sức khỏe liên quan đến ' || t.topic || ' và chuẩn bị câu hỏi khi đi khám.'),
           jsonb_build_object('heading', 'Gợi ý tiếp theo', 'body', 'Hãy trao đổi với nhân viên y tế nếu triệu chứng kéo dài, nặng lên hoặc ảnh hưởng sinh hoạt.' )
       ),
       (i % 15 <> 0)
FROM generate_series(1, 500) AS i
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('Nhận diện sớm dấu hiệu của'), ('Cách phòng ngừa hiệu quả'), ('Hướng dẫn tự chăm sóc cho người'),
        ('Chế độ ăn uống hợp lý cho người'), ('Khi nào cần đi khám vì'), ('Các giai đoạn tiến triển của'),
        ('Điều trị hiện đại cho'), ('Tầm quan trọng của tái khám với'), ('Sai lầm thường gặp về'),
        ('Hỏi đáp bác sĩ về'), ('Phục hồi chức năng sau'), ('Hỗ trợ người nhà mắc'),
        ('Theo dõi tại nhà cho người'), ('Vận động an toàn cho người'), ('Thuốc thường dùng trong'),
        ('Cận lâm sàng cần thiết khi nghi ngờ'), ('Chẩn đoán phân biệt trong'), ('Phòng khám chuyên sâu về'),
        ('Câu chuyện người bệnh vượt qua'), ('Sống khỏe dài dài dù mắc')
    ) AS a(angle)
    OFFSET ((i - 1) % 20) LIMIT 1
) a
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('cao huyết áp', 'Tim mạch', 'tim-mach'), ('bệnh động mạch vành', 'Tim mạch', 'tim-mach'),
        ('rối loạn nhịp tim', 'Tim mạch', 'tim-mach'), ('hen phế quản', 'Hô hấp', 'ho-hap'),
        ('viêm phế quản mạn tính', 'Hô hấp', 'ho-hap'), ('viêm loét dạ dày', 'Tiêu hóa', 'tieu-hoa'),
        ('trào ngược dạ dày thực quản', 'Tiêu hóa', 'tieu-hoa'), ('xơ gan', 'Gan mật', 'tieu-hoa'),
        ('sỏi thận', 'Tiết niệu', 'tiet-nieu'), ('đái tháo đường type 2', 'Nội tiết', 'noi-tiet'),
        ('bệnh tuyến giáp', 'Nội tiết', 'noi-tiet'), ('đau nửa đầu', 'Thần kinh', 'than-kinh'),
        ('thoái hóa khớp gối', 'Cơ xương khớp', 'co-xuong-khop'), ('viêm da dị ứng', 'Da liễu', 'da-lieu'),
        ('viêm xoang', 'Tai mũi họng', 'tai-mui-hong'), ('đục thủy tinh thể', 'Mắt', 'mat'),
        ('sâu răng', 'Răng hàm mặt', 'rang-ham-mat'), ('tiền sản giật', 'Sản phụ khoa', 'san-phu-khoa'),
        ('dậy thì sớm ở trẻ', 'Nhi khoa', 'nhi-khoa'), ('rối loạn tiết niệu ở nam', 'Nam khoa', 'nam-khoa'),
        ('thiếu máu thiếu sắt', 'Huyết học', 'huyet-hoc'), ('sức khỏe tâm thần', 'Tâm thần kinh', 'than-kinh'),
        ('béo phì', 'Dinh dưỡng', 'dinh-duong'), ('loãng xương', 'Cơ xương khớp', 'co-xuong-khop'),
        ('u xơ tử cung', 'Sản phụ khoa', 'san-phu-khoa')
    ) AS t(topic, category, slug)
    OFFSET (((i - 1) / 20) % 25) LIMIT 1
) t
ON CONFLICT (slug) DO NOTHING;

-- ── FAQs (150 = 10 question frames × 15 clinical focuses) ─────────────────────
INSERT INTO faqs (id, question, answer, active)
SELECT md5(format('large-faq:%s', i))::uuid,
       q.question_prefix || f.name || q.question_suffix,
       q.answer_prefix || f.name || q.answer_suffix,
       (i % 30 <> 0)
FROM generate_series(1, 150) AS i
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('Có nên khám định kỳ cho bệnh lý ', ' không?', 'Có. ', ' tiến triển âm thầm, khám định kỳ giúp phát hiện sớm và điều trị kịp thời trước khi xuất hiện biến chứng.'),
        ('Triệu chứng thường gặp của bệnh lý ', ' là gì?', 'Tùy giai đoạn, bệnh lý ', ' có thể gây mệt mỏi, đau tức tại vùng liên quan và ảnh hưởng sinh hoạt; cần đi khám khi triệu chứng kéo dài.'),
        ('Quy trình khám và chẩn đoán ', ' diễn ra thế nào?', 'Bác sĩ sẽ khai thác tiền sử, khám lâm sàng và chỉ định cận lâm sàng phù hợp để xác định mức độ ', ' trước khi lên kế hoạch điều trị.'),
        ('Chi phí thăm khám cho ', ' có được tư vấn trước không?', 'Có. Bạn sẽ được tư vấn lộ trình và chi phí dự kiến cho ', ' trước khi thực hiện cận lâm sàng.'),
        ('Người nhà cần hỗ trợ gì cho người bệnh ', '?', 'Gia đình nên nhắc lịch uống thuốc, đồng hành trong các lần tái khám và ghi nhận diễn tiến triệu chứng liên quan đến ', ' để bác sĩ điều chỉnh điều trị.'),
        ('Chế độ sinh hoạt phù hợp cho người ', ' như thế nào?', 'Người bệnh ', ' nên duy trì giấc ngủ đủ, vận động vừa sức và tuân thủ chế độ ăn bác sĩ khuyến nghị.'),
        ('Khám ', ' có cần chuẩn bị gì trước không?', 'Bạn nên mang kết quả khám cũ, danh mục thuốc đang dùng và đến trước giờ hẹn 15 phút để quy trình khám ', ' diễn ra thuận lợi.'),
        ('Bao lâu thì nên tái khám sau khi điều trị ', '?', 'Tần suất tái khám cho ', ' phụ thuộc giai đoạn điều trị; bác sĩ sẽ hẹn lịch cụ thể sau mỗi lần khám.'),
        ('Bệnh lý ', ' có nguy hiểm nếu để lâu không điều trị?', 'Nhiều trường hợp ', ' tiến triển âm thầm trong năm đầu; trì hoãn điều trị làm tăng nguy cơ biến chứng và khó điều trị hơn.'),
        ('Phụ nữ mang thai và trẻ em khám ', ' có an toàn không?', 'Có. Quy trình thăm khám ', ' cho phụ nữ mang thai và trẻ em được điều chỉnh phù hợp theo hướng dẫn chuyên khoa.')
    ) AS q(question_prefix, question_suffix, answer_prefix, answer_suffix)
    OFFSET ((i - 1) % 10) LIMIT 1
) q
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('tim mạch'), ('hô hấp'), ('tiêu hóa'), ('tuyến giáp'), ('thần kinh'),
        ('cơ xương khớp'), ('da liễu'), ('tai mũi họng'), ('sản phụ khoa'), ('nhi khoa'),
        ('nam khoa'), ('dinh dưỡng'), ('huyết học'), ('ung bướu'), ('mắt')
    ) AS f(name)
    OFFSET (((i - 1) / 10) % 15) LIMIT 1
) f
ON CONFLICT DO NOTHING;

-- ── Doctor ↔ Specialty (avg 2-3 per doctor ≈ 1250) ───────────────────────────
INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT md5(format('large-doctor-specialty:%s:%s', d.id, s.id))::uuid, d.id, s.id
FROM doctors d
JOIN LATERAL (
    SELECT id FROM specialties
    ORDER BY md5(d.id::text || ':' || specialties.id::text)
    LIMIT 2 + (abs(hashtext(d.id::text)) % 2)
) s ON true
ON CONFLICT (doctor_id, specialty_id) DO NOTHING;

-- ── Doctor ↔ Branch (avg 1-2 per doctor ≈ 750) ───────────────────────────────
INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT md5(format('large-doctor-branch:%s:%s', d.id, b.id))::uuid, d.id, b.id
FROM doctors d
JOIN LATERAL (
    SELECT id FROM branches
    ORDER BY md5(d.id::text || ':' || branches.id::text)
    LIMIT 1 + (abs(hashtext(d.id::text)) % 2)
) b ON true
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

-- ── Doctor schedules (weekday morning + afternoon for every branch link) ─────
-- Keep the large fixture bookable as well as searchable: every active doctor /
-- branch relationship receives deterministic recurring windows for Monday-Friday.
INSERT INTO doctor_schedules (
    id, doctor_id, branch_id, day_of_week, start_time, end_time,
    slot_duration_minutes, effective_from, effective_to, active
)
SELECT md5(format('large-schedule:%s:%s:%s:%s:%s', db.doctor_id, db.branch_id, shifts.day_of_week, shifts.start_time, shifts.end_time))::uuid,
       db.doctor_id, db.branch_id,
       shifts.day_of_week, shifts.start_time::time, shifts.end_time::time,
       30, DATE '2026-01-01', NULL, true
FROM doctor_branches db
JOIN doctors d ON d.id = db.doctor_id AND d.active = true
CROSS JOIN (VALUES
    (1, '08:00:00', '11:30:00'),
    (1, '13:30:00', '17:00:00'),
    (2, '08:00:00', '11:30:00'),
    (2, '13:30:00', '17:00:00'),
    (3, '08:00:00', '11:30:00'),
    (3, '13:30:00', '17:00:00'),
    (4, '08:00:00', '11:30:00'),
    (4, '13:30:00', '17:00:00'),
    (5, '08:00:00', '11:30:00'),
    (5, '13:30:00', '17:00:00')
) AS shifts(day_of_week, start_time, end_time)
ON CONFLICT (id) DO NOTHING;

-- ── Users (1001: 1000 synthetic + 1 local admin) ─────────────────────────────
-- BCrypt hash of the documented local demo password — local dev only,
-- never a real secret.
INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
SELECT md5(format('large-user:%s', i))::uuid,
       'user' || i || '@healthcare.local',
       '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa',
       'Bệnh nhân ' || i,
       CASE WHEN (i % 50 = 0) THEN 'DISABLED' ELSE 'ACTIVE' END,
       TIMESTAMPTZ '2026-01-01T08:00:00+07:00' - ((i % 365) || ' days')::interval,
       TIMESTAMPTZ '2026-01-01T08:00:00+07:00'
FROM generate_series(1, 1000) AS i
ON CONFLICT (email) DO NOTHING;

-- Deterministic local ADMIN fixture for CMS verification.
-- Credentials are for this fictional local seed only; never reuse them outside
-- the demo stack. It uses the same local demo password as the base seed and
-- LOCAL_RUNBOOK.md.
INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
VALUES (
    '90000000-0000-0000-0000-000000000001',
    'admin@healthcare.local',
    '$2b$10$OG9QfyAPA/hWfWauU7lXvemQNUnFPcVj/rIuE2zzocw7rtOKoQdfa',
    'Quản trị viên local',
    'ACTIVE',
    TIMESTAMPTZ '2026-01-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-01-01T08:00:00+07:00'
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── Patient profiles (avg 1 per 2 users ≈ 500) ───────────────────────────────
INSERT INTO patient_profiles (id, user_id, full_name, phone, email)
SELECT md5('large-patient:' || u.id::text)::uuid, u.id, u.display_name, '09' || lpad((abs(hashtext(u.id::text)) % 100000000)::text, 8, '0'), u.email
FROM users u
WHERE (abs(hashtext(u.id::text)) % 2 = 0)
ON CONFLICT DO NOTHING;

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

INSERT INTO user_roles (user_id, role_id)
SELECT '90000000-0000-0000-0000-000000000001', id
FROM roles
WHERE code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- ── Clinical medical records (200) ───────────────────────────────────────────
INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, icd10_code, icd10_name, diagnosis, symptoms_summary, created_at, updated_at)
SELECT md5(format('large-medical-record:%s', i))::uuid, NULL, p.id, d.id,
       'ICD-' || (i % 99 + 1),
       'Chẩn đoán y khoa số ' || i,
       'Chẩn đoán lâm sàng mẫu cho bệnh nhân ' || i,
       'Tóm tắt triệu chứng mẫu số ' || i,
       TIMESTAMPTZ '2026-06-01T08:00:00+07:00' - ((i % 180) || ' days')::interval,
       TIMESTAMPTZ '2026-06-01T08:00:00+07:00'
FROM generate_series(1, 200) AS i,
     LATERAL (SELECT id FROM patient_profiles ORDER BY md5('large-medical-record:' || i::text || ':' || patient_profiles.id::text) LIMIT 1) p,
     LATERAL (SELECT id FROM doctors ORDER BY md5('large-medical-record:' || i::text || ':' || doctors.id::text) LIMIT 1) d
ON CONFLICT (id) DO NOTHING;

-- ── Prescriptions (150) ──────────────────────────────────────────────────────
INSERT INTO prescriptions (id, medical_record_id, prescription_code, patient_id, doctor_id, diagnosis_summary, status, created_at, updated_at)
SELECT md5(format('large-prescription:%s', i))::uuid, mr.id, 'RX-2026-' || lpad(i::text, 4, '0'), mr.patient_id, mr.doctor_id, 'Đơn thuốc theo bệnh án', 'ACTIVE', mr.created_at, mr.created_at
FROM generate_series(1, 150) AS i,
     LATERAL (SELECT id, patient_id, doctor_id, created_at FROM medical_records ORDER BY md5('large-prescription:' || i::text || ':' || medical_records.id::text) LIMIT 1) mr
ON CONFLICT (id) DO NOTHING;

-- ── Prescription items (avg 3 per prescription ≈ 450) ───────────────────────
INSERT INTO prescription_items (id, prescription_id, medication_name, dosage, unit, frequency, duration_days, total_quantity, created_at)
SELECT md5(format('large-prescription-item:%s:%s', rx.id, i))::uuid, rx.id,
       'Thuốc ' || (i % 20 + 1),
       (5 + (i % 5) * 50) || 'mg',
       'Viên',
       (1 + (i % 3)) || ' lần/ngày',
       7 + (i % 14),
       10 + (i % 20),
       rx.created_at
FROM prescriptions rx
CROSS JOIN generate_series(1, 3) AS i
ON CONFLICT (id) DO NOTHING;

-- ── Diagnostic results (100) ─────────────────────────────────────────────────
INSERT INTO diagnostic_results (id, patient_id, doctor_id, test_name, result, test_date)
SELECT md5(format('large-diagnostic:%s', i))::uuid, p.id, d.id,
       'Xét nghiệm ' || (i % 15 + 1),
       'Kết quả bình thường, chưa có dấu hiệu bất thường.',
       TIMESTAMPTZ '2026-07-01T08:00:00+07:00' - ((i % 90) || ' days')::interval
FROM generate_series(1, 100) AS i,
     LATERAL (SELECT id FROM patient_profiles ORDER BY md5('large-diagnostic:' || i::text || ':' || patient_profiles.id::text) LIMIT 1) p,
     LATERAL (SELECT id FROM doctors ORDER BY md5('large-diagnostic:' || i::text || ':' || doctors.id::text) LIMIT 1) d
ON CONFLICT (id) DO NOTHING;

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
) VALUES
(
    '80000000-0000-0000-0000-000000000001',
    'homepage.hero',
    'HERO',
    '{"eyebrow":"Chăm sóc chủ động","title":"Đồng hành cùng sức khỏe gia đình","body":"Đặt lịch khám và tìm hiểu dịch vụ chăm sóc phù hợp với nhu cầu của bạn.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED',
    1,
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000002',
    'careers.hero',
    'HERO',
    '{"eyebrow":"Cơ hội nghề nghiệp tại HealthCare","title":"Cùng chăm sóc người bệnh bằng năng lực và sự tử tế","body":"Khám phá môi trường làm việc đề cao an toàn, phối hợp liên chuyên môn và sự phát triển bền vững của mỗi thành viên.","ctaLabel":"Xem vị trí đang tuyển","ctaHref":"/careers#vi-tri-dang-tuyen"}'::jsonb,
    'PUBLISHED',
    1,
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000003',
    'careers.body',
    'RICH_TEXT',
    '{"title":"Điều chúng tôi mong đợi ở đồng đội","body":"Chúng tôi trân trọng tinh thần học hỏi, giao tiếp rõ ràng và cam kết đặt an toàn của người bệnh lên hàng đầu trong mọi vai trò."}'::jsonb,
    'PUBLISHED',
    1,
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000004',
    'search.hero',
    'HERO',
    '{"eyebrow":"Danh mục đã xuất bản","title":"Tìm kiếm theo thông tin bệnh viện","body":"Kết quả bên dưới được lọc trực tiếp từ chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang của HealthCare."}'::jsonb,
    'PUBLISHED',
    1,
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00'
),
(
    '80000000-0000-0000-0000-000000000005',
    'homepage.body',
    'RICH_TEXT',
    '{"title":"Hành trình chăm sóc được cập nhật","body":"Thông tin mới từ bệnh viện sẽ xuất hiện tại đây sau khi được xuất bản. Dữ liệu chuyên khoa, bác sĩ và cơ sở luôn được cập nhật theo danh mục hiện tại."}'::jsonb,
    'PUBLISHED',
    1,
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00',
    TIMESTAMPTZ '2026-08-01T08:00:00+07:00'
)
ON CONFLICT (slot_key) DO NOTHING;

-- The large seed is supported as a Compose bootstrap dataset. Like the default
-- local seed, persist one durable public cursor row per seeded CMS slot so
-- already-open frontend sessions can reconcile through SSE replay/heartbeat.
-- Keep this idempotent: if a preserved admin edit owns the slot, the seed row
-- id will not match and no synthetic event is generated for that admin-owned
-- content.
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
)
SELECT gen_random_uuid(), slug, title, department, location, employment_type, summary,
       responsibilities, requirements, benefits, featured, true
FROM (VALUES
    ('dieu-duong-da-khoa', 'Điều dưỡng đa khoa', 'Khối Điều dưỡng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
     'Phối hợp cùng bác sĩ và đội ngũ chăm sóc để hỗ trợ người bệnh trong suốt quá trình thăm khám, điều trị.',
     E'Tiếp nhận, theo dõi và thực hiện chăm sóc người bệnh theo phân công\nThực hiện đúng quy trình an toàn người bệnh và kiểm soát nhiễm khuẩn\nGhi nhận thông tin chăm sóc đầy đủ, phối hợp bàn giao giữa các ca',
     E'Tốt nghiệp Cao đẳng hoặc Đại học chuyên ngành Điều dưỡng\nCó giấy phép hành nghề phù hợp theo quy định hiện hành\nGiao tiếp rõ ràng, tôn trọng người bệnh và phối hợp nhóm tốt',
     E'Quy trình hội nhập và hướng dẫn công việc rõ ràng\nTham gia đào tạo chuyên môn theo kế hoạch của bệnh viện\nChế độ làm việc và phúc lợi theo chính sách hiện hành', true),
    ('ky-thuat-vien-xet-nghiem', 'Kỹ thuật viên xét nghiệm', 'Khối Cận lâm sàng', 'Bệnh viện An Tâm Trung tâm', 'FULL_TIME',
     'Thực hiện các bước tiếp nhận và xử lý mẫu xét nghiệm, góp phần bảo đảm kết quả chính xác và đúng thời gian.',
     E'Tiếp nhận, kiểm tra và xử lý mẫu theo quy trình chuyên môn\nVận hành thiết bị trong phạm vi được phân công và ghi nhận kiểm soát chất lượng\nPhối hợp trả kết quả và báo cáo các tình huống cần lưu ý',
     E'Tốt nghiệp chuyên ngành Kỹ thuật xét nghiệm y học\nCẩn trọng, có khả năng làm việc theo quy trình và theo ca\nƯu tiên ứng viên có giấy phép hành nghề phù hợp',
     E'Được hướng dẫn quy trình và hệ thống chất lượng khi nhận việc\nCơ hội học hỏi trong môi trường phối hợp đa chuyên khoa\nChế độ làm việc và phúc lợi theo chính sách hiện hành', false),
    ('chuyen-vien-cham-soc-khach-hang', 'Chuyên viên chăm sóc khách hàng', 'Trải nghiệm người bệnh', 'Phòng khám An Tâm Thảo Điền', 'FULL_TIME',
     'Hướng dẫn người bệnh và thân nhân tiếp cận đúng dịch vụ, lịch khám và kênh hỗ trợ tại cơ sở.',
     E'Tiếp nhận nhu cầu, hướng dẫn thủ tục và điều phối thông tin tại quầy\nGiải đáp trong phạm vi được phân công, chuyển tiếp đúng bộ phận khi cần\nGhi nhận phản hồi để cải thiện trải nghiệm người bệnh',
     E'Tốt nghiệp Trung cấp, Cao đẳng hoặc Đại học\nGiọng nói rõ ràng, giao tiếp điềm tĩnh và chủ động\nCó thể sử dụng các công cụ văn phòng cơ bản',
     E'Được đào tạo về quy trình tiếp đón và bảo mật thông tin\nMôi trường làm việc phối hợp và tôn trọng\nChế độ làm việc và phúc lợi theo chính sách hiện hành', false),
    ('thuc-tap-sinh-hanh-chinh-nhan-su', 'Thực tập sinh Hành chính – Nhân sự', 'Hành chính – Nhân sự', 'Văn phòng An Tâm Trung tâm', 'INTERNSHIP',
     'Hỗ trợ các công việc hành chính, lưu trữ và trải nghiệm nhân viên dưới sự hướng dẫn của phụ trách bộ phận.',
     E'Hỗ trợ chuẩn bị hồ sơ, biểu mẫu và sắp xếp tài liệu\nPhối hợp tổ chức hoạt động nội bộ theo kế hoạch\nCập nhật tiến độ công việc và bảo mật thông tin được tiếp cận',
     E'Sinh viên năm cuối các ngành Quản trị nhân lực, Hành chính hoặc ngành liên quan\nCẩn thận, đúng hẹn và sẵn sàng học hỏi\nSử dụng được các công cụ văn phòng cơ bản',
     E'Có người hướng dẫn trong thời gian thực tập\nĐược tiếp cận quy trình vận hành trong môi trường bệnh viện\nXác nhận thực tập theo quy định khi hoàn thành', false)
) AS seed(slug, title, department, location, employment_type, summary, responsibilities, requirements, benefits, featured)
ON CONFLICT (slug) DO NOTHING;
COMMIT;
