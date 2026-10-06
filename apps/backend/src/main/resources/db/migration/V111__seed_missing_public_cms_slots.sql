-- Seed the remaining unpublished public CMS slots so /search, /huong-dan and
-- /about footer stop 404-ing the shared CMS frame and become editable through
-- the admin CMS. Follows the V92 pattern: idempotent contents insert plus one
-- durable public change-feed row per slot. Never overwrites editor work --
-- WHERE NOT EXISTS guards every row by slot_key.

-- /search -------------------------------------------------------------------
INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000001'::uuid,
    'search.body',
    'RICH_TEXT',
    '{"title":"Cách đặt câu hỏi tìm kiếm hiệu quả","body":"Nhập tên chuyên khoa, bác sĩ, dịch vụ, gói khám hoặc bài viết bạn cần — ví dụ: \"tim mạch\", \"khám tổng quát\", \"tăng huyết áp\". Hệ thống lọc trực tiếp trên dữ liệu đã xuất bản của bệnh viện, không gợi ý nội dung ngoài danh mục chính thức."}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'search.body');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000002'::uuid,
    'search.sidebar',
    'NOTICE',
    '{"title":"Không tìm thấy nội dung?","body":"Gọi tổng đài 028 1800 0001 hoặc dùng trang Hỏi đáp để được hướng dẫn chọn đúng chuyên khoa và dịch vụ phù hợp với nhu cầu của bạn."}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'search.sidebar');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000003'::uuid,
    'search.footer',
    'CTA_BANNER',
    '{"title":"Đã tìm được dịch vụ phù hợp?","body":"Đặt lịch khám trực tuyến trong vài phút — chọn chuyên khoa, bác sĩ và khung giờ còn trống ngay trên hệ thống.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'search.footer');

-- /huong-dan -----------------------------------------------------------------
INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000004'::uuid,
    'huong-dan.hero',
    'HERO',
    '{"eyebrow":"Lộ trình khám rõ ràng","title":"Hướng dẫn khám bệnh từng bước","body":"Từ đặt lịch trực tuyến, chuẩn bị hồ sơ, quy trình tiếp đến thanh toán và nhận kết quả — mọi bước được chuẩn hóa để bạn an tâm trong suốt hành trình chăm sóc sức khỏe.","ctaLabel":"Đặt lịch ngay","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'huong-dan.hero');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000005'::uuid,
    'huong-dan.body',
    'RICH_TEXT',
    '{"title":"Quy trình khám tiêu chuẩn tại HealthCare","body":"Bước 1: Đặt lịch trực tuyến hoặc qua tổng đài 028 1800 0001 và nhận mã lịch hẹn. Bước 2: Đến trước giờ hẹn 15 phút, mang theo giấy tờ tùy thân và kết quả khám cũ nếu có. Bước 3: Khai báo y tế, đo sinh hiệu và chờ gọi số tại khu tiếp đón. Bước 4: Bác sĩ khám, chỉ định cận lâm sàng khi cần và giải thích phác đồ. Bước 5: Thanh toán, nhận đơn thuốc và hẹn tái khám — toàn bộ hồ sơ được lưu trên cổng thông tin cá nhân để tra cứu lại."}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'huong-dan.body');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000006'::uuid,
    'huong-dan.sidebar',
    'NOTICE',
    '{"title":"Chuẩn bị trước khi khám","body":"Nhịn ăn 8 giờ nếu có xét nghiệm máu; ghi sẵn các thuốc đang dùng và bệnh nền; mang theo sổ bảo hiểm y tế nếu khám theo quyền lợi BHYT."}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'huong-dan.sidebar');

INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000007'::uuid,
    'huong-dan.footer',
    'CTA_BANNER',
    '{"title":"Sẵn sàng cho buổi khám đầu tiên?","body":"Đặt lịch trực tuyến để giữ chỗ với bác sĩ phù hợp — xác nhận lịch hẹn ngay trên website.","ctaLabel":"Đặt lịch khám","ctaHref":"/dat-lich"}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'huong-dan.footer');

-- /about footer ---------------------------------------------------------------
INSERT INTO cms_contents (
    id, slot_key, component_type, payload, status, version, created_at, updated_at
)
SELECT
    '11100000-0000-0000-0001-000000000008'::uuid,
    'about.footer',
    'CTA_BANNER',
    '{"title":"Đồng hành cùng bạn trong mọi quyết định sức khỏe","body":"Đội ngũ chuyên khoa và hệ thống cơ sở của HealthCare sẵn sàng tiếp nhận nhu cầu thăm khám của bạn và gia đình.","ctaLabel":"Chọn cơ sở gần bạn","ctaHref":"/branches"}'::jsonb,
    'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM cms_contents c WHERE c.slot_key = 'about.footer');

-- One durable public change-feed row per seeded slot so already-open sessions
-- reconcile through SSE replay/heartbeat (mirrors V92).
INSERT INTO cms_content_changes (
    content_id, slot_key, content_version, published, actor_email,
    component_type, status, payload, public_event, changed_at
)
SELECT
    c.id,
    c.slot_key,
    c.version,
    TRUE,
    'admin@healthcare.com',
    c.component_type,
    c.status,
    c.payload,
    TRUE,
    c.updated_at
FROM cms_contents c
WHERE c.slot_key IN (
    'search.body', 'search.sidebar', 'search.footer',
    'huong-dan.hero', 'huong-dan.body', 'huong-dan.sidebar', 'huong-dan.footer',
    'about.footer'
)
  AND NOT EXISTS (
      SELECT 1
      FROM cms_content_changes ch
      WHERE ch.content_id = c.id
        AND ch.content_version = c.version
        AND ch.published = TRUE
  );
