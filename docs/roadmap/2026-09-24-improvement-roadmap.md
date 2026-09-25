# Lộ trình cải thiện — 2026-09-24

Kết quả của đợt rà soát sâu (4 luồng khảo sát song song: kiến trúc, WIP,
thanh toán, bảo mật/vận hành). Các mục đã xử lý trong đợt này nằm ở cuối tài
liệu; phần dưới là những việc CẦN QUYẾT ĐÁNH HOẶC TÀI NGUYÊN LỚN, xếp theo
độ ưu tiên.

## 1. Ưu tiên cao (hạ tầng & dữ liệu)

### 1.1 Cách ly mạng cho Postgres/Redis hosted
- Bằng chứng: `render.yaml:26,33` — `ipAllowList: []` cho cả
  `healthcare-beta-postgres` và `healthcare-beta-redis`; API đang mở hoàn toàn
  ra internet, an toàn chỉ còn dựa vào credential.
- Việc cần: cấu hình IP allowlist trên Render dashboard (backend + thế giới
  ngoài bị chặn), bật SSL/TLS bắt buộc cho connection. Đây là thay đổi dashboard
  (không làm được từ repo).
- Rủi ro nếu chậm: rò rỉ `DATABASE_URL` = toàn bộ PII bệnh nhân.

### 1.2 RLS / defense-in-depth cho schema public
- Bằng chứng: 105 migration Flyway không có RLS nào; Supabase schema
  `healthcare` thì có RLS đầy đủ + event trigger chặn grant lạ.
- Đề xuất: không áp RLS cho toàn bộ app (authz ở app là chính), nhưng cân nhắc
 Postgres role hạn chế cho backend (không SUPERUSER, revoke mặc định) và audit
  định kỳ theo mẫu event-trigger của Supabase.

### 1.3 Backup / PITR tự động
- Bằng chứng: `docs/deployment-beta.md:339-349` — Render Free Postgres không có
  PITR; rollback là thủ công + capsule SQL `supabase/reconciliation/`.
- Đề xuất: pg_dump định kỳ (cron worker hoặc GitHub Actions hàng tuần) đẩy lên
  object storage ngoài, kèm 1 lần restore-drill có ghi evidence.

## 2. Ưu tiên trung (ứng dụng)

### 2.1 CSP bỏ `unsafe-inline`
- Bằng chứng: `apps/frontend/next.config.ts:25` — `script-src 'self' 'unsafe-inline'`.
- Cách làm: middleware tạo nonce per-request + CSP header động; phải chạy lại
  toàn bộ Playwright e2e (TinyMCE, chart.js nhúng inline). Làm khi có phiên
  riêng, revert nhanh nếu gãy UI.

### 2.2 Next.js middleware route guard
- Không có `middleware.ts`; trang admin/patient chỉ chặn ở client + backend
  (backend vẫn là thẩm quyền cuối qua BFF). Middleware chỉ là UX — redirect sớm
  khi thiếu session, không phải biện pháp bảo mật.

### 2.3 Structured logging (logback JSON)
- Backend đang log console text thuần; điều tra sự cố khó. Thêm
  `logback-spring.xml` với encoder JSON + request-id MDC (đã có trace không
  nội dung từ BFF).

### 2.4 Secret scanning chuyên dụng
- Hiện chỉ regex tự viết trong hygiene job trên HEAD tree. Đề xuất: gitleaks
  (full history) + GitHub push protection; cân nhắc SBOM (Syft) cho GHCR images.

## 3. Ưu tiên trung (sản phẩm thanh toán — bước tiếp theo)
- **Tích hợp gateway thật (VNPay/MoMo)** trên seam `PaymentChannelProvider`
  đã mở: thêm provider mới + tự động PAID qua IPN có chữ ký, giữ nguyên hàng
  duyệt cho kênh chuyển khoản thủ công.
- **Nhắc thanh toán**: job nhắc email/notification trước `payByDeadline` cho
  trạng thái UNPAID.
- **Đối soát tập trung**: gộp webhook-events + statement rows + payments vào
  một màn hình "vận hành thu ngân" với bộ lọc và xuất CSV.

## 4. Nợ kỹ thuật cấu trúc (dọn dần theo đợt)

| Vị trí | Dòng | Vấn đề |
| --- | --- | --- |
| `apps/frontend/lib/api-client.ts` | 3.470 | client + store gộp một file |
| `apps/backend/.../AiConversationService.java` | 2.255 | service AI chat quá lớn |
| `apps/backend/.../PublicAiChatController.java` | 1.323 | controller + helper đời sống request |
| `apps/frontend/app/patient/dashboard/page.tsx` | 2.282 | dashboard + payment panel + calendar |
| `components/editor/RichTextEditor.tsx` | 2.236 | editor monolith |
| `components/BookingModal.tsx` | 2.221 | modal đặt lịch + OTP + payment handoff |

- **Dual route trees**: thư mục route tiếng Việt cũ (`/chuyen-khoa`,
  `/bac-si`, …) vẫn tồn tại song song với route chuẩn dù đã redirect — xoá hẳn
  khi không còn bookmark traffic.
- **PWA danh nghĩa**: có manifest + offline indicator nhưng không có service
  worker; hoặc làm worker thật (cache-first cho tĩnh) hoặc bỏ chữ PWA khỏi README.
- **i18n**: nội dung hardcode tiếng Việt; nếu cần i18n chính thức, chọn thư viện
  trước khi viết thêm trang mới.
- **Feature-flag sprawl**: ~60 cờ `APP_*`/`AI_*` trong `application.yml`; rà lại
  mỗi quý, xoá cờ đã mặc định hoá.
- **TinyMCE GPL**: quyết định license chưa chốt (README) — giữ self-host GPL
  hoặc đổi editor MIT trước khi thương mại hoá.

## 5. Đã xử lý trong đợt này (tham chiếu commit)
- `ddd53a9` — WIP AI-chat cancellation end-to-end (đã xác thực test, commit riêng).
- `36f4c27` — payment: sweep hold đồng bộ payment, idempotency-key ổn định phía
  client, dead-letter webhook + trang admin, webhook ack tối thiểu, gate
  VERIFY, fan-out admin phân trang, hạn thanh toán hiển thị.
- `edaca4a` — biên nhận PDF bất biến (payment_invoices, HD-YYYY-NNNNNN).
- `6fcf2fa` — nhập sao kê CSV khớp tự động qua cổng confirm, khử trùng lặp theo hash.
- `0becf35` — seam `PaymentChannelProvider` (chuẩn bị gateway).
- Commit E — dọn crash log cục bộ, quét phụ thuộc CI (npm audit per-push +
  workflow weekly dependency-check), enforce host allowlist egress AI.
- Quyết định sản phẩm (theo yêu cầu chủ dự án): thanh toán là **giả lập** —
  `DemoMutationBoundaryFilter` không còn chặn duyệt/hoàn tiền/nhập sao kê của
  admin demo, để luồng "bệnh nhân khai báo → admin accept → PAID" chạy trọn vẹn
  trong demo. AI-credit, user admin và đổi mật khẩu vẫn bị chặn cho demo.
- CSP nonce: chuyển vào mục 2.1 theo escape hatch của kế hoạch (rủi ro gãy UI
  đáng kể, cần phiên e2e riêng).
