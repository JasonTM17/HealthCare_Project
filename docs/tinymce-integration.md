# TinyMCE — Tích hợp trình soạn thảo văn bản phong phú (Rich Text Editor)

> Tài liệu nghiệp vụ cho ban vận hành và đội kỹ thuật. Áp dụng cho bản deploy
> `45995ee` trở về sau (nhánh main từ 2026-10-01).

## 1. TinyMCE được dùng ở đâu?

| Bề mặt | Vai trò | File chính |
| --- | --- | --- |
| Trang quản trị **Nội dung CMS** (`/admin/content`) | Bác sĩ/biên tập soạn bài viết health education (HERO, RICH_TEXT, CTA_BANNER…) | `apps/ai-service` (lưu trữ) + `apps/frontend/components/cms/CmsEditor.tsx` |
| **Bài viết cộng đồng bác sĩ** (`/doctor/articles`) | Bác sĩ soạn bài viết y tế chia sẻ cho bệnh nhân | `apps/frontend/app/doctor/articles/page.tsx` |
| Component dùng chung | `components/editor/RichTextEditor.tsx` — wrapper chuẩn hoá TinyMCE cho toàn hệ thống | mọi bề mặt trên |

Toàn bộ văn bản soạn bằng TinyMCE đi qua **quy trình duyệt nội dung** trước khi
hiện thị công khai: bài viết → `ai_content_review_heads` (APPROVED) → vòng
duyệt doctor → lọt "hash fence" → mới được AI service đưa vào catalog RAG.

## 2. Cấu hình kỹ thuật

- **Phiên bản**: TinyMCE 8.x qua `@tinymce/tinymce-react` 6.x (kiểm tra
  `apps/frontend/package.json`).
- **Wrapper**: `components/editor/RichTextEditor.tsx` chuẩn hoá:
  - thanh công cụ giới hạn đúng các nút an toàn (không HTML thô, không script);
  - dán (paste) được làm sạch;
  - giới hạn độ dài nội dung theo hợp đồng API;
  - chế độ **Mã nguồn / Chế độ chỉ soạn thảo** cho người dùng nâng cao;
  - chống XSS: nội dung lưu qua backend được kiểm duyệt tại
    `RichTextEditor` + `rich-content-safety` tests (xem
    `apps/frontend/tests/rich-content-safety.test.mjs`).
- **Biến môi trường liên quan**: không có key cloud (TinyMCE chạy self-hosted
  theo gói npm, không gọi cloud API — giữ offline-by-default).

## 3. Quy trình nghiệp vụ chuẩn

1. Bác sĩ đăng nhập `/doctor/articles` → **Đăng bài viết mới**.
2. Soạn: tiêu đề → tóm tắt → nội dung (TinyMCE) → chuyên mục.
3. **Đăng bài viết ngay** → bài vào hàng chờ duyệt.
4. Admin duyệt tại luồng clinical review (`ai_content_review_heads`).
5. Bài đủ điều kiện mới được AI service đưa vào catalog RAG phục vụ
   grounding của trợ lý AI.

## 4. Lỗi đã biết và trạng thái

| Hiện tượng | Nguyên nhân | Trạng thái |
| --- | --- | --- |
| Thanh công cụ/nút soạn thảo hiển thị thiếu hoặc rỗng trên production | Cần kiểm tra thêm ở tầng browser/CSS — **chưa ghi nhận được ở local** (mọi nút render đầy đủ khi test tự động) | Theo dõi |
| Từ khoá y tế trong bài viết bị gate egress chặn oan khi ingest (vd "hồ sơ điện tử cá nhân", "họ tên, ngày sinh") | ĐÃ FIX — PR #77/#80 thêm exemption hẹp cho ingest clinical đã duyệt | Đã merge |
| Vòng reconcile bỏ lỡ các document sau một document lỗi | ĐÃ FIX — PR #74/#80 fault-isolation từng document | Đã merge |

## 5. Kiểm thử

```bash
cd apps/frontend
npm run test            # toàn bộ unit suite (798 test)
python -m pytest        # apps/ai-service (798 test, gồm contract + safety gate)
```

E2E liên quan trình soạn thảo: `tests/e2e` — các bài test
`admin-critical-actions`, `multi-user-roles-realtime` đều chạm TinyMCE.

## 6. Liên quan

- Sự cố grounding đóng băng catalog (2026-09-27 → 10-01): xem PR #73/#74/#77/#80.
- Lệnh ingest RAG: `apps/ai-service/app/rag.py` (equal-revision đã idempotent
  từ PR #77).
