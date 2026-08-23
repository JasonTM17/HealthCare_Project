-- =============================================================================
-- HealthCare Supabase seed
--
-- Rebuilds the Supabase-native catalog mirror, synthetic customer base, and
-- public RAG documents with deterministic IDs. This seed is intended for local
-- reset/bootstrap flows, not for live production data import.
-- =============================================================================

BEGIN;

SET search_path = healthcare, extensions, public;

TRUNCATE TABLE
    healthcare.ai_documents,
    healthcare.patient_profiles,
    healthcare.customers,
    healthcare.doctor_specialties,
    healthcare.doctor_branches,
    healthcare.doctors,
    healthcare.branches,
    healthcare.specialties,
    healthcare.services,
    healthcare.packages,
    healthcare.articles,
    healthcare.faqs
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Specialties (30)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.specialties (id, name, slug, description, common_symptoms, preparation_steps, care_pathway, active)
SELECT md5('supabase-specialty:' || slug)::uuid,
       name,
       slug,
       description,
       jsonb_build_array(
           'Triệu chứng liên quan đến ' || lower(name),
           'Mệt mỏi kéo dài',
           'Khó chịu khi vận động'
       ),
       jsonb_build_array(
           'Mang theo giấy tờ tùy thân',
           'Ghi lại thuốc đang dùng',
           'Đến sớm 15 phút nếu cần xét nghiệm'
       ),
       'Tiếp nhận → khám chuyên khoa → cận lâm sàng khi cần → tư vấn theo dõi.',
       true
FROM (VALUES
    ('Tim mạch', 'tim-mach', 'Khám và điều trị bệnh lý tim, mạch máu và tăng huyết áp.'),
    ('Thần kinh', 'than-kinh', 'Khám và điều trị đau đầu, rối loạn giấc ngủ và bệnh lý thần kinh.'),
    ('Tiêu hóa', 'tieu-hoa', 'Khám và điều trị bệnh lý dạ dày, ruột, gan mật.'),
    ('Nội tổng quát', 'noi-tong-quat', 'Khám sàng lọc và quản lý bệnh mạn tính.'),
    ('Nhi khoa', 'nhi-khoa', 'Khám và điều trị bệnh lý trẻ em.'),
    ('Sản phụ khoa', 'san-phu-khoa', 'Khám thai, tầm soát và chăm sóc sức khỏe sinh sản.'),
    ('Cơ xương khớp', 'co-xuong-khop', 'Điều trị đau khớp, thoái hóa và chấn thương cơ xương.'),
    ('Tai mũi họng', 'tai-mui-hong', 'Điều trị viêm họng, viêm xoang và rối loạn tiền đình.'),
    ('Da liễu', 'da-lieu', 'Điều trị bệnh lý da, tóc, móng và thẩm mỹ da.'),
    ('Mắt', 'mat', 'Khám và điều trị bệnh lý mắt, đo kính và tật khúc xạ.'),
    ('Răng hàm mặt', 'rang-ham-mat', 'Khám và điều trị răng, hàm, mặt.'),
    ('Tiết niệu', 'tiet-nieu', 'Điều trị bệnh lý thận, tiết niệu và nam khoa.'),
    ('Hô hấp', 'ho-hap', 'Khám và điều trị phổi, khí quản và dị ứng hô hấp.'),
    ('Nội tiết', 'noi-tiet', 'Điều trị tiểu đường, tuyến giáp và rối loạn chuyển hóa.'),
    ('Ung bướu', 'ung-buou', 'Theo dõi và điều trị ung thư.'),
    ('Huyết học', 'huyet-hoc', 'Điều trị bệnh lý máu và rối loạn đông máu.'),
    ('Ngoại khoa', 'ngoai-khoa', 'Phẫu thuật và can thiệp ngoại khoa tổng quát.'),
    ('Ngoại thần kinh', 'ngoai-than-kinh', 'Phẫu thuật sọ não, cột sống và dây thần kinh.'),
    ('Chấn thương chỉnh hình', 'chan-thuong-chinh-hinh', 'Điều trị gãy xương, trật khớp và chấn thương.'),
    ('Phục hồi chức năng', 'phuc-hoi-chuc-nang', 'Vật lý trị liệu và phục hồi sau bệnh.'),
    ('Thính học', 'thinh-hoc', 'Đánh giá thính lực và rối loạn nghe.'),
    ('Dinh dưỡng', 'dinh-duong', 'Tư vấn chế độ ăn và dinh dưỡng lâm sàng.'),
    ('Giải phẫu bệnh', 'giai-phau-benh', 'Chẩn đoán bệnh lý mô và xét nghiệm mô học.'),
    ('Miễn dịch dị ứng', 'mien-dich-di-ung', 'Điều trị dị ứng và bệnh tự miễn.'),
    ('Nội mạch máu', 'noi-mach-mau', 'Can thiệp mạch máu và siêu âm Doppler.'),
    ('Sơ cấp cứu', 'so-cap-cuu', 'Xử trí cấp cứu và hồi sức tích cực.'),
    ('Y học cổ truyền', 'y-hoc-co-truyen', 'Bồi bổ, châm cứu và thuốc nam.'),
    ('Nam khoa', 'nam-khoa', 'Khám và điều trị bệnh lý nam giới.'),
    ('Da liễu thẩm mỹ', 'da-lieu-tham-my', 'Thẩm mỹ da, laser và điều trị sẹo.'),
    ('Y tế công cộng', 'y-te-cong-cong', 'Phòng bệnh, tiêm chủng và sức khỏe cộng đồng.')
) AS v(name, slug, description);

-- ---------------------------------------------------------------------------
-- Branches (20)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.branches (id, name, slug, address, phone, working_hours, emergency_hotline, map_url, amenities, active)
SELECT md5('supabase-branch:' || s.idx::text)::uuid,
       'Bệnh viện Đa khoa An Tâm - Cơ sở ' || s.idx,
       'co-so-' || s.idx,
       (s.idx || ' Đường số ' || (s.idx % 30 + 1) || ', Quận ' || (s.idx % 12 + 1) || ', TP. Hồ Chí Minh'),
       '028 ' || lpad((38000000 + s.idx)::text, 8, '0'),
       '06:30–20:00, tất cả các ngày',
       '028 1800 ' || lpad(s.idx::text, 4, '0'),
       'https://maps.google.com/?q=HealthCare+Branch+' || s.idx,
       jsonb_build_array('Quầy tiếp đón', 'Khu lấy mẫu', 'Wi-Fi miễn phí', 'Nhà thuốc'),
       true
FROM generate_series(1, 20) AS s(idx);

-- ---------------------------------------------------------------------------
-- Doctors (500)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.doctors (id, full_name, slug, bio, photo_url, active)
SELECT md5('supabase-doctor:' || gs.idx::text)::uuid,
       names.ho[1 + (gs.idx % 5)] || ' ' || names.dem[1 + ((gs.idx * 3) % 6)] || ' ' || names.ten[1 + ((gs.idx * 7) % 8)],
       'bs-' || gs.idx,
       'Bác sĩ chuyên khoa với ' || (8 + (gs.idx % 15)) || ' năm kinh nghiệm điều trị và chăm sóc người bệnh.',
       NULL,
       (gs.idx % 20 <> 0)
FROM generate_series(1, 500) AS gs(idx),
     LATERAL (
         SELECT ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Võ', 'Đỗ', 'Bùi', 'Hoàng', 'Đặng', 'Ngô'] AS ho,
                ARRAY['Văn', 'Thị', 'Minh', 'Quốc', 'Hoàng', 'Thanh', 'Thu', 'Ngọc', 'Anh'] AS dem,
                ARRAY['Khôi', 'Hà', 'Đức', 'Yến', 'Huy', 'Mai', 'Long', 'Trung', 'Lan', 'Phúc'] AS ten
     ) AS names;

-- ---------------------------------------------------------------------------
-- Services (200)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.services (id, name, slug, description, active)
SELECT md5('supabase-service:' || i::text)::uuid,
       'Dịch vụ y tế ' || i,
       'dv-' || i,
       'Dịch vụ khám, tư vấn và điều trị chuyên sâu với quy trình được chuẩn hóa.',
       (i % 25 <> 0)
FROM generate_series(1, 200) AS i;

-- ---------------------------------------------------------------------------
-- Packages (100)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.packages (id, name, slug, description, price, target_audience, duration_days, checklist, preparation_steps, active)
SELECT md5('supabase-package:' || i::text)::uuid,
       'Gói khám sức khỏe cấp ' || c || ' #' || i,
       'goi-' || i,
       'Gói khám toàn diện bao gồm xét nghiệm, chẩn đoán hình ảnh và tư vấn chuyên sâu.',
       (500000 + (i * 12345))::numeric(12, 2),
       'Người trưởng thành cần kiểm tra sức khỏe định kỳ',
       1 + (i % 3),
       jsonb_build_array('Khám lâm sàng', 'Xét nghiệm cơ bản', 'Tư vấn kết quả'),
       jsonb_build_array('Mang theo giấy tờ tùy thân', 'Đến trước giờ hẹn 15 phút'),
       (i % 20 <> 0)
FROM generate_series(1, 100) AS i,
     LATERAL (SELECT chr(64 + 1 + (i % 3)) AS c) AS lvl;

-- ---------------------------------------------------------------------------
-- Articles (500)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.articles (id, title, slug, summary, body, published_at, category, author_name, reading_minutes, related_specialty_slug, sections, active)
SELECT md5('supabase-article:' || i::text)::uuid,
       'Bài viết y khoa số ' || i,
       'bv-' || i,
       'Tóm tắt nội dung y khoa hữu ích cho người bệnh và thân nhân.',
       'Nội dung chi tiết về phòng bệnh, sớm nhận biết triệu chứng và khi nào nên đi khám chuyên khoa.',
       TIMESTAMPTZ '2026-08-01T08:00:00+07:00' - ((i % 180) || ' days')::interval,
       CASE WHEN i % 3 = 0 THEN 'Tim mạch' WHEN i % 3 = 1 THEN 'Sức khỏe gia đình' ELSE 'Dinh dưỡng' END,
       'Đội ngũ chuyên môn',
       4 + (i % 6),
       CASE WHEN i % 3 = 0 THEN 'tim-mach' WHEN i % 3 = 1 THEN 'nhi-khoa' ELSE 'noi-tong-quat' END,
       jsonb_build_array(
           jsonb_build_object(
               'heading', 'Tổng quan',
               'body', 'Thông tin được biên soạn để giúp người đọc nhận biết rủi ro sức khỏe và chuẩn bị câu hỏi khi đi khám.'
           ),
           jsonb_build_object(
               'heading', 'Gợi ý tiếp theo',
               'body', 'Hãy trao đổi với nhân viên y tế nếu triệu chứng kéo dài, nặng lên hoặc ảnh hưởng sinh hoạt.'
           )
       ),
       (i % 15 <> 0)
FROM generate_series(1, 500) AS i;

-- ---------------------------------------------------------------------------
-- FAQs (150)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.faqs (id, question, answer, active)
SELECT md5('supabase-faq:' || i::text)::uuid,
       'Câu hỏi thường gặp số ' || i || ': làm thế nào để được hỗ trợ y tế phù hợp?',
       'Bệnh viện hỗ trợ qua nhiều kênh: đặt lịch trực tuyến, gọi điện thoại hoặc đến trực tiếp quầy lễ tân.',
       (i % 30 <> 0)
FROM generate_series(1, 150) AS i;

-- ---------------------------------------------------------------------------
-- Doctor ↔ Specialty (avg 2-3 per doctor)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.doctor_specialties (id, doctor_id, specialty_id)
SELECT md5('supabase-doctor-specialty:' || d.id::text || ':' || s.id::text)::uuid, d.id, s.id
FROM healthcare.doctors d
JOIN LATERAL (
    SELECT id
    FROM healthcare.specialties
    ORDER BY md5(d.id::text || ':' || healthcare.specialties.id::text)
    LIMIT 2 + (abs(hashtextextended(d.id::text, 0)) % 2)
) s ON true;

-- ---------------------------------------------------------------------------
-- Doctor ↔ Branch (avg 1-2 per doctor)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.doctor_branches (id, doctor_id, branch_id)
SELECT md5('supabase-doctor-branch:' || d.id::text || ':' || b.id::text)::uuid, d.id, b.id
FROM healthcare.doctors d
JOIN LATERAL (
    SELECT id
    FROM healthcare.branches
    ORDER BY md5(d.id::text || ':' || healthcare.branches.id::text)
    LIMIT 1 + (abs(hashtextextended(d.id::text, 0)) % 2)
) b ON true;

-- ---------------------------------------------------------------------------
-- Customers (10,000 synthetic customers)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.customers (
    id, customer_code, legacy_user_id, auth_user_id, full_name, email,
    phone, status, synthetic
)
SELECT md5('supabase-customer:' || i::text)::uuid,
       'KH-' || lpad(i::text, 6, '0'),
       md5('large-user:' || i::text)::uuid,
       NULL,
       'Khách hàng ' || i,
       'customer' || i || '@healthcare.local',
       '09' || lpad(i::text, 8, '0'),
       CASE
           WHEN i % 50 = 0 THEN 'DISABLED'
           WHEN i % 13 = 0 THEN 'PENDING'
           ELSE 'ACTIVE'
       END,
       true
FROM generate_series(1, 10000) AS i;

-- ---------------------------------------------------------------------------
-- Patient profiles (75% of customers)
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.patient_profiles (
    id, customer_id, legacy_patient_profile_id, date_of_birth, gender,
    address, emergency_contact_name, emergency_contact_phone
)
SELECT md5('supabase-patient-profile:' || c.id::text)::uuid,
       c.id,
       md5('large-patient:' || c.legacy_user_id::text)::uuid,
       (DATE '1980-01-01' + ((abs(hashtextextended(c.id::text, 0)) % 12000) || ' days')::interval)::date,
       CASE (abs(hashtextextended(c.id::text, 0)) % 4)
           WHEN 0 THEN 'MALE'
           WHEN 1 THEN 'FEMALE'
           WHEN 2 THEN 'OTHER'
           ELSE 'UNSPECIFIED'
       END,
       'Địa chỉ ' || (abs(hashtextextended(c.id::text, 0)) % 1000 + 1) || ', TP. Hồ Chí Minh',
       'Người thân ' || (abs(hashtextextended(c.id::text, 0)) % 100 + 1),
       '09' || lpad(replace(c.customer_code, 'KH-', ''), 8, '0')
FROM healthcare.customers c
WHERE substring(c.customer_code from 4)::integer <= 7500;

-- ---------------------------------------------------------------------------
-- Public RAG documents sourced from the catalog mirror
-- ---------------------------------------------------------------------------
INSERT INTO healthcare.ai_documents (
    source_type, source_id, title, content, metadata, embedding,
    embedding_model, embedding_provenance, content_hash, sync_revision,
    active, published, published_at, deleted_at
)
SELECT
    'specialty',
    s.id::text,
    s.name,
    coalesce(s.description, s.name),
    jsonb_build_object('slug', s.slug, 'category', 'specialty'),
    healthcare.synthetic_embedding('specialty:' || s.id::text),
    'local-hash',
    'local_provider',
    encode(digest(coalesce(s.description, s.name), 'sha256'), 'hex'),
    1,
    s.active,
    true,
    TIMESTAMPTZ '2026-01-01T00:00:00+07:00'
        + ((abs(hashtextextended(s.id::text, 0)) % 365) || ' days')::interval,
    NULL::timestamptz
FROM healthcare.specialties s
UNION ALL
SELECT
    'doctor',
    d.id::text,
    d.full_name,
    coalesce(d.bio, d.full_name),
    jsonb_build_object('slug', d.slug, 'category', 'doctor'),
    healthcare.synthetic_embedding('doctor:' || d.id::text),
    'local-hash',
    'local_provider',
    encode(digest(coalesce(d.bio, d.full_name), 'sha256'), 'hex'),
    1,
    d.active,
    true,
    TIMESTAMPTZ '2026-01-01T00:00:00+07:00'
        + ((abs(hashtextextended(d.id::text, 0)) % 365) || ' days')::interval,
    NULL::timestamptz
FROM healthcare.doctors d
UNION ALL
SELECT
    'service',
    s.id::text,
    s.name,
    coalesce(s.description, s.name),
    jsonb_build_object('slug', s.slug, 'category', 'service'),
    healthcare.synthetic_embedding('service:' || s.id::text),
    'local-hash',
    'local_provider',
    encode(digest(coalesce(s.description, s.name), 'sha256'), 'hex'),
    1,
    s.active,
    true,
    TIMESTAMPTZ '2026-01-01T00:00:00+07:00'
        + ((abs(hashtextextended(s.id::text, 0)) % 365) || ' days')::interval,
    NULL::timestamptz
FROM healthcare.services s
UNION ALL
SELECT
    'package',
    p.id::text,
    p.name,
    coalesce(p.description, p.name),
    jsonb_build_object('slug', p.slug, 'category', 'package'),
    healthcare.synthetic_embedding('package:' || p.id::text),
    'local-hash',
    'local_provider',
    encode(digest(coalesce(p.description, p.name), 'sha256'), 'hex'),
    1,
    p.active,
    true,
    TIMESTAMPTZ '2026-01-01T00:00:00+07:00'
        + ((abs(hashtextextended(p.id::text, 0)) % 365) || ' days')::interval,
    NULL::timestamptz
FROM healthcare.packages p
UNION ALL
SELECT
    'article',
    a.id::text,
    a.title,
    coalesce(a.summary, a.body, a.title),
    jsonb_build_object('slug', a.slug, 'category', 'article', 'specialty', a.related_specialty_slug),
    healthcare.synthetic_embedding('article:' || a.id::text),
    'local-hash',
    'local_provider',
    encode(digest(coalesce(a.summary, a.body, a.title), 'sha256'), 'hex'),
    1,
    a.active,
    a.published_at is not null,
    a.published_at,
    NULL::timestamptz
FROM healthcare.articles a
UNION ALL
SELECT
    'faq',
    f.id::text,
    f.question,
    f.answer,
    jsonb_build_object('category', 'faq'),
    healthcare.synthetic_embedding('faq:' || f.id::text),
    'local-hash',
    'local_provider',
    encode(digest(f.answer, 'sha256'), 'hex'),
    1,
    f.active,
    true,
    TIMESTAMPTZ '2026-01-01T00:00:00+07:00'
        + ((abs(hashtextextended(f.id::text, 0)) % 365) || ' days')::interval,
    NULL::timestamptz
FROM healthcare.faqs f;

COMMIT;
