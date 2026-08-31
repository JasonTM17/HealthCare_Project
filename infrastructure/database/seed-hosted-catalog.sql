-- Hosted synthetic catalog seed for the Render Free beta.
--
-- This file is deliberately limited to public catalog/CMS rows.  It never
-- creates users, passwords, patient profiles, medical records, or tokens.
-- Every key is deterministic and every statement is idempotent, so a rerun
-- after a transient deploy is safe.  The seed is for the disposable beta
-- database only; Supabase remains the separate healthcare projection store.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Serialize this beta-only data operation with another seed/rollback attempt.
-- The advisory lock is transaction-scoped and disappears automatically on
-- COMMIT/ROLLBACK; it does not become application state.
SELECT pg_advisory_xact_lock(
  hashtextextended('healthcare-hosted-catalog-seed-v1', 0)
);

-- Refuse to mix this deterministic fixture with an unrelated catalog. A
-- second run over the exact fixture remains allowed; the rollback capsule
-- performs the stronger post-seed fingerprint and consumer checks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM specialties
    WHERE NOT (slug = ANY (ARRAY[
      'tim-mach','than-kinh','tieu-hoa','noi-tong-hop','nhi-khoa',
      'san-phu-khoa','co-xuong-khop','tai-mui-hong','da-lieu','mat',
      'rang-ham-mat','tiet-nieu','ho-hap','noi-tiet','ung-buou','huyet-hoc',
      'ngoai-khoa','ngoai-than-kinh','chan-thuong-chinh-hinh',
      'phuc-hoi-chuc-nang','thinh-hoc','dinh-duong','giai-phau-benh',
      'mien-dich-di-ung','noi-mach-mau','so-cap-cuu','y-hoc-co-truyen',
      'nam-khoa','da-lieu-tham-my','y-te-cong-cong'
    ]::text[]))
  ) THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected specialty slug';
  END IF;
  IF EXISTS (SELECT 1 FROM branches WHERE slug !~ '^cs-([1-9]|1[0-9]|20)$') THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected branch slug';
  END IF;
  IF EXISTS (SELECT 1 FROM doctors WHERE slug !~ '^bs-([1-9]|[1-9][0-9]|[1-4][0-9][0-9]|500)$') THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected doctor slug';
  END IF;
  IF EXISTS (SELECT 1 FROM services WHERE slug !~ '^dv-([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$') THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected service slug';
  END IF;
  IF EXISTS (SELECT 1 FROM packages WHERE slug !~ '^goi-([1-9]|[1-9][0-9]|100)$') THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected package slug';
  END IF;
  IF EXISTS (SELECT 1 FROM articles WHERE slug !~ '^bv-([1-9]|[1-9][0-9]|[1-4][0-9][0-9]|500)$') THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected article slug';
  END IF;
  IF EXISTS (
    SELECT 1 FROM faqs
    WHERE id NOT IN (
      SELECT md5(format('hosted-faq:%s', i))::uuid
      FROM generate_series(1, 150) AS expected(i)
    )
  ) THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected FAQ identity';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cms_contents
    WHERE slot_key NOT IN ('homepage.hero','careers.hero','careers.body',
                           'search.hero','homepage.body')
  ) THEN
    RAISE EXCEPTION 'hosted catalog seed refused: unexpected CMS slot';
  END IF;
END $$;

-- Base catalog ---------------------------------------------------------------
INSERT INTO specialties (id, name, slug, description, common_symptoms,
                         preparation_steps, care_pathway, active)
SELECT md5('hosted-specialty:' || v.slug)::uuid,
       v.name,
       v.slug,
       v.description,
       jsonb_build_array('Triệu chứng liên quan đến ' || lower(v.name),
                         'Mệt mỏi kéo dài'),
       jsonb_build_array('Mang theo kết quả khám cũ nếu có',
                         'Ghi lại thuốc đang sử dụng'),
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
  ('Ung bướu','ung-buou','Theo dõi và điều trị ung bướu, ung thư.'),
  ('Huyết học','huyet-hoc','Điều trị bệnh lý máu, thiếu máu, rối loạn đông máu.'),
  ('Ngoại khoa','ngoai-khoa','Phẫu thuật và can thiệp ngoại khoa tổng quát.'),
  ('Ngoại thần kinh','ngoai-than-kinh','Phẫu thuật sọ não, cột sống, dây thần kinh.'),
  ('Chấn thương chỉnh hình','chan-thuong-chinh-hinh','Điều trị gãy xương, trật khớp, chấn thương.'),
  ('Phục hồi chức năng','phuc-hoi-chuc-nang','Vật lý trị liệu, phục hồi sau bệnh.'),
  ('Thính học','thinh-hoc','Đánh giá thính lực, rối loạn thính giác.'),
  ('Dinh dưỡng','dinh-duong','Tư vấn chế độ ăn, dinh dưỡng lâm sàng.'),
  ('Giải phẫu bệnh','giai-phau-benh','Chẩn đoán bệnh lý mô, xét nghiệm giải phẫu.'),
  ('Miễn dịch dị ứng','mien-dich-di-ung','Điều trị dị ứng, bệnh tự miễn.'),
  ('Nội mạch máu','noi-mach-mau','Can thiệp mạch máu, siêu âm Doppler.'),
  ('Sơ cấp cứu','so-cap-cuu','Xử trí cấp cứu, hồi sức tích cực.'),
  ('Y học cổ truyền','y-hoc-co-truyen','Bồi bổ, châm cứu, điều trị thuốc nam.'),
  ('Nam khoa','nam-khoa','Khám và điều trị bệnh lý nam giới.'),
  ('Da liễu thẩm mỹ','da-lieu-tham-my','Thẩm mỹ da, laser, điều trị sẹo.'),
  ('Y tế công cộng','y-te-cong-cong','Phòng bệnh, tiêm chủng, sức khỏe cộng đồng.')
) AS v(name, slug, description)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO branches (id, name, slug, address, phone, working_hours,
                      emergency_hotline, map_url, amenities, active)
SELECT md5(format('hosted-branch:%s', s.idx))::uuid,
       'Bệnh viện Đa khoa Sài Gòn Xanh - Cơ sở ' || s.idx,
       'cs-' || s.idx,
       s.idx || ' Đường số ' || (s.idx % 30 + 1) || ', Quận ' ||
         (s.idx % 12 + 1) || ', TP. Hồ Chí Minh',
       '028 ' || lpad((38000000 + s.idx)::text, 8, '0'),
       '06:30–20:00, tất cả các ngày',
       '028 1800 ' || lpad(s.idx::text, 4, '0'),
       'https://maps.google.com/?q=HealthCare+Branch+' || s.idx,
       jsonb_build_array('Quầy tiếp đón', 'Khu lấy mẫu', 'Wi-Fi miễn phí'),
       true
FROM generate_series(1, 20) AS s(idx)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO doctors (id, full_name, slug, bio, photo_url, active)
SELECT md5(format('hosted-doctor:%s', gs.idx))::uuid,
       names.ho[1 + (gs.idx % 5)] || ' ' ||
         names.dem[1 + ((gs.idx * 3) % 6)] || ' ' ||
         names.ten[1 + ((gs.idx * 7) % 8)],
       'bs-' || gs.idx,
       'Bác sĩ chuyên khoa với ' || (8 + (gs.idx % 15)) ||
         ' năm kinh nghiệm điều trị và chăm sóc bệnh nhân.',
       NULL,
       (gs.idx % 20 <> 0)
FROM generate_series(1, 500) AS gs(idx),
     LATERAL (SELECT ARRAY['Nguyễn','Trần','Lê','Phạm','Võ'] AS ho,
                     ARRAY['Văn','Thị','Minh','Quốc','Hoàng','Thanh'] AS dem,
                     ARRAY['Khôi','Hà','Đức','Yến','Huy','Mai','Long','Trung'] AS ten) AS names
ON CONFLICT (slug) DO NOTHING;

INSERT INTO services (id, name, slug, description, active)
SELECT md5(format('hosted-service:%s', i))::uuid,
       'Dịch vụ y tế ' || i,
       'dv-' || i,
       'Dịch vụ khám, tư vấn và điều trị chuyên sâu, trang bị thiết bị hiện đại.',
       (i % 25 <> 0)
FROM generate_series(1, 200) AS i
ON CONFLICT (slug) DO NOTHING;

INSERT INTO packages (id, name, slug, description, price, target_audience,
                      duration_days, checklist, preparation_steps, active)
SELECT md5(format('hosted-package:%s', i))::uuid,
       'Gói khám sức khỏe cấp ' || chr(65 + (i % 3)) || ' #' || i,
       'goi-' || i,
       'Gói khám toàn diện bao gồm xét nghiệm, chẩn đoán hình ảnh và tư vấn chuyên sâu.',
       (500000 + (i * 12345))::numeric(12,2),
       'Người trưởng thành cần kiểm tra sức khỏe định kỳ',
       1 + (i % 3),
       jsonb_build_array('Khám lâm sàng', 'Xét nghiệm cơ bản', 'Tư vấn kết quả'),
       jsonb_build_array('Mang theo giấy tờ tùy thân', 'Đến trước giờ hẹn 15 phút'),
       (i % 20 <> 0)
FROM generate_series(1, 100) AS i
ON CONFLICT (slug) DO NOTHING;

INSERT INTO articles (id, title, slug, summary, body, published_at, category,
                      author_name, reading_minutes, related_specialty_slug,
                      sections, active)
SELECT md5(format('hosted-article:%s', i))::uuid,
       'Bài viết y khoa số ' || i,
       'bv-' || i,
       'Tóm tắt nội dung y khoa hữu ích cho bệnh nhân và người nhà.',
       'Nội dung chi tiết về phòng bệnh, sớm nhận biết triệu chứng và khi nào nên đi khám bác sĩ chuyên khoa.',
       TIMESTAMPTZ '2026-08-01T08:00:00+07:00' - ((i % 180) || ' days')::interval,
       CASE WHEN i % 3 = 0 THEN 'Tim mạch'
            WHEN i % 3 = 1 THEN 'Sức khỏe gia đình'
            ELSE 'Dinh dưỡng' END,
       'Đội ngũ chuyên môn',
       4 + (i % 6),
       CASE WHEN i % 3 = 0 THEN 'tim-mach'
            WHEN i % 3 = 1 THEN 'nhi-khoa'
            ELSE 'noi-tong-hop' END,
       jsonb_build_array(
         jsonb_build_object('heading', 'Tổng quan', 'body', 'Thông tin được biên soạn để giúp người đọc nhận biết rủi ro sức khỏe và chuẩn bị câu hỏi khi đi khám.'),
         jsonb_build_object('heading', 'Gợi ý tiếp theo', 'body', 'Hãy trao đổi với nhân viên y tế nếu triệu chứng kéo dài, nặng lên hoặc ảnh hưởng sinh hoạt.')
       ),
       (i % 15 <> 0)
FROM generate_series(1, 500) AS i
ON CONFLICT (slug) DO NOTHING;

INSERT INTO faqs (id, question, answer, active)
SELECT md5(format('hosted-faq:%s', i))::uuid,
       'Câu hỏi thường gặp số ' || i || ': làm thế nào để được hỗ trợ y tế phù hợp?',
       'Bệnh viện hỗ trợ qua nhiều kênh: đặt lịch trực tuyến, gọi điện thoại hoặc đến trực tiếp quầy lễ tân.',
       (i % 30 <> 0)
FROM generate_series(1, 150) AS i
ON CONFLICT DO NOTHING;

-- Catalog relationships and booking windows ---------------------------------
INSERT INTO doctor_specialties (id, doctor_id, specialty_id)
SELECT md5(format('hosted-doctor-specialty:%s:%s', d.id, s.id))::uuid,
       d.id,
       s.id
FROM doctors d
JOIN LATERAL (
  SELECT id FROM specialties
  ORDER BY md5(d.id::text || ':' || specialties.id::text)
  LIMIT 2 + (abs(hashtext(d.id::text)) % 2)
) s ON true
ON CONFLICT (doctor_id, specialty_id) DO NOTHING;

INSERT INTO doctor_branches (id, doctor_id, branch_id)
SELECT md5(format('hosted-doctor-branch:%s:%s', d.id, b.id))::uuid,
       d.id,
       b.id
FROM doctors d
JOIN LATERAL (
  SELECT id FROM branches
  ORDER BY md5(d.id::text || ':' || branches.id::text)
  LIMIT 1 + (abs(hashtext(d.id::text)) % 2)
) b ON true
ON CONFLICT (doctor_id, branch_id) DO NOTHING;

INSERT INTO doctor_schedules (
  id, doctor_id, branch_id, day_of_week, start_time, end_time,
  slot_duration_minutes, effective_from, effective_to, active
)
SELECT md5(format('hosted-schedule:%s:%s:%s:%s:%s', db.doctor_id,
                  db.branch_id, shifts.day_of_week, shifts.start_time,
                  shifts.end_time))::uuid,
       db.doctor_id,
       db.branch_id,
       shifts.day_of_week,
       shifts.start_time::time,
       shifts.end_time::time,
       30,
       DATE '2026-01-01',
       NULL,
       true
FROM doctor_branches db
JOIN doctors d ON d.id = db.doctor_id AND d.active = true
CROSS JOIN (VALUES
  (1, '08:00:00', '11:30:00'), (1, '13:30:00', '17:00:00'),
  (2, '08:00:00', '11:30:00'), (2, '13:30:00', '17:00:00'),
  (3, '08:00:00', '11:30:00'), (3, '13:30:00', '17:00:00'),
  (4, '08:00:00', '11:30:00'), (4, '13:30:00', '17:00:00'),
  (5, '08:00:00', '11:30:00'), (5, '13:30:00', '17:00:00')
) AS shifts(day_of_week, start_time, end_time)
ON CONFLICT (id) DO NOTHING;

-- Public CMS slots used by the homepage/search shell. ------------------------
INSERT INTO cms_contents (
  id, slot_key, component_type, payload, status, version, created_at, updated_at
)
VALUES
 ('80000000-0000-0000-0000-000000000001', 'homepage.hero', 'HERO',
  '{"eyebrow":"Chăm sóc chủ động","title":"Đồng hành cùng sức khỏe gia đình","body":"Đặt lịch khám và tìm hiểu dịch vụ chăm sóc phù hợp với nhu cầu của bạn.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
  'PUBLISHED', 1, TIMESTAMPTZ '2026-08-01T08:00:00+07:00', TIMESTAMPTZ '2026-08-01T08:00:00+07:00'),
 ('80000000-0000-0000-0000-000000000002', 'careers.hero', 'HERO',
  '{"eyebrow":"Cơ hội nghề nghiệp tại HealthCare","title":"Cùng chăm sóc người bệnh bằng năng lực và sự tử tế","body":"Khám phá môi trường làm việc đề cao an toàn, phối hợp liên chuyên môn và sự phát triển bền vững của mỗi thành viên.","ctaLabel":"Xem vị trí đang tuyển","ctaHref":"/careers#vi-tri-dang-tuyen"}'::jsonb,
  'PUBLISHED', 1, TIMESTAMPTZ '2026-08-01T08:00:00+07:00', TIMESTAMPTZ '2026-08-01T08:00:00+07:00'),
 ('80000000-0000-0000-0000-000000000003', 'careers.body', 'RICH_TEXT',
  '{"title":"Điều chúng tôi mong đợi ở đồng đội","body":"Chúng tôi trân trọng tinh thần học hỏi, giao tiếp rõ ràng và cam kết đặt an toàn của người bệnh lên hàng đầu trong mọi vai trò."}'::jsonb,
  'PUBLISHED', 1, TIMESTAMPTZ '2026-08-01T08:00:00+07:00', TIMESTAMPTZ '2026-08-01T08:00:00+07:00'),
 ('80000000-0000-0000-0000-000000000004', 'search.hero', 'HERO',
  '{"eyebrow":"Catalog active","title":"Tìm kiếm theo dữ liệu đã xuất bản","body":"Kết quả được lọc trực tiếp từ chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang của backend."}'::jsonb,
  'PUBLISHED', 1, TIMESTAMPTZ '2026-08-01T08:00:00+07:00', TIMESTAMPTZ '2026-08-01T08:00:00+07:00'),
 ('80000000-0000-0000-0000-000000000005', 'homepage.body', 'RICH_TEXT',
  '{"title":"Hành trình chăm sóc được cập nhật","body":"Thông tin mới từ quản trị viên sẽ xuất hiện tại đây theo version đã xuất bản. Dữ liệu chuyên khoa, bác sĩ và cơ sở vẫn được đọc trực tiếp từ catalog backend."}'::jsonb,
  'PUBLISHED', 1, TIMESTAMPTZ '2026-08-01T08:00:00+07:00', TIMESTAMPTZ '2026-08-01T08:00:00+07:00')
ON CONFLICT (slot_key) DO NOTHING;

-- Bind a successful run to the exact deterministic fixture. The two V36
-- trigger-owned updated_at columns are the only volatile fields omitted.
DO $$
DECLARE
  expected_row record;
  actual_count bigint;
  actual_fingerprint text;
  fingerprint_expression text;
BEGIN
  FOR expected_row IN
    SELECT *
    FROM (VALUES
      ('specialties'::text, 30::bigint, '899a9267602e4b60fafd6bece647f6df'::text),
      ('branches'::text, 20::bigint, '6fcd5df7f5e627c1022b3744972293e7'::text),
      ('doctors'::text, 500::bigint, '07198dcddf11eff03c7c38165c2035aa'::text),
      ('services'::text, 200::bigint, '2aeb6e31744bd84504d3ed7a2451f9f6'::text),
      ('packages'::text, 100::bigint, 'e517e4c93275d9b26b959ee5a367c61c'::text),
      ('articles'::text, 500::bigint, 'fa5fe51fd11cc521fed4f4d3a8495154'::text),
      ('faqs'::text, 150::bigint, 'd8c82adeac2eb30330a1d2626c47cf94'::text),
      ('doctor_specialties'::text, 1251::bigint, '959e409228543cbd157623fd23b35deb'::text),
      ('doctor_branches'::text, 751::bigint, 'f224056ac7909e83dd2e626e9b64685a'::text),
      ('doctor_schedules'::text, 7130::bigint, 'ddeb42964f8215b659a1782098441942'::text),
      ('cms_contents'::text, 5::bigint, 'd62093f80d7f8d08e99dad0bc15a8ea5'::text),
      ('cms_content_changes'::text, 0::bigint, 'd41d8cd98f00b204e9800998ecf8427e'::text)
    ) AS expected(table_name, expected_count, expected_fingerprint)
  LOOP
    fingerprint_expression := CASE
      WHEN expected_row.table_name IN ('articles', 'faqs')
        THEN 'to_jsonb(x) - ''updated_at'''
      ELSE 'to_jsonb(x)'
    END;
    EXECUTE format(
      'SELECT count(*), md5(coalesce(string_agg((%s)::text, '''' ORDER BY id), '''')) FROM %I x',
      fingerprint_expression,
      expected_row.table_name
    ) INTO actual_count, actual_fingerprint;
    IF actual_count <> expected_row.expected_count
       OR actual_fingerprint <> expected_row.expected_fingerprint THEN
      RAISE EXCEPTION
        'hosted catalog seed refused: % postcondition mismatch (expected %/% got %/%)',
        expected_row.table_name,
        expected_row.expected_count,
        expected_row.expected_fingerprint,
        actual_count,
        actual_fingerprint;
    END IF;
  END LOOP;
END $$;

COMMIT;
