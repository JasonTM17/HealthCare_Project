# Stitch: Notification Panel (Cổng thông báo bác sĩ + admin)

- **Nguồn**: Stitch MCP, project `1816799799990259439` (https://stitch.withgoogle.com/projects/1816799799990259439)
- **Tool**: `generate_screen_from_text` (DESKTOP, GEMINI_3_8_FLASH)
- **Ngày**: 2026-09-20
- **Trạng thái**: thiết kế tham chiếu cho workstream WS-B (chuông thông báo doctor/admin)

## Prompt thiết kế đã dùng

Dropdown 380px neo dưới icon chuông ở header cổng bác sĩ:

- **Header**: tiêu đề "Thông báo" + pill số chưa đọc (nền `#0d9488`, chữ trắng) + nút chữ "Đánh dấu đã đọc".
- **Danh sách 4 dòng thông báo**, mỗi dòng:
  - icon tròn nhỏ (calendar = lịch hẹn mới, stethoscope = cập nhật care plan, chat bubble = tin nhắn tư vấn);
  - thông điệp 2 dòng tiếng Việt, ví dụ "Lịch hẹn mới: Nguyễn Văn A, 09:00 - 09:30, Cơ sở Trần Hưng Đạo";
  - timestamp tương đối "5 phút trước" chữ nhỏ màu muted.
- **Trạng thái chưa đọc**: nền tint `#f0fdfa` + thanh nhấn trái 3px `#0d9488`; đã đọc: nền trắng.
- **Divider** `#e2e8f0` giữa các dòng; footer link "Xem tất cả" căn giữa màu `#0f766e`.
- **Phong cách**: flat, không shadow, viền 1px `#e2e8f0`, bo góc 12px, font Be Vietnam Pro, 100% tiếng Việt.

## Gợi ý do Stitch đề xuất thêm (chưa làm — backlog)

1. Bộ lọc thông báo theo danh mục (Lịch hẹn / Cận lâm sàng / Hội chẩn).
2. Trang chi tiết "Xem tất cả thông báo" toàn màn hình.
3. Empty state khi không có thông báo mới (BẮT BUỘC làm cùng WS-B).

## Hợp đồng triển khai FE (khớp token-swap WS-D)

- Reuse tokens `.portal-shell`: `--stitch-primary` `#0d9488`, `--stitch-primary-hover` `#0f766e`, `--stitch-primary-surface` `#f0fdfa`, `--portal-line` `#e2e8f0`.
- Panel: `border: 1px solid var(--portal-line); border-radius: 12px; box-shadow: none; width: min(380px, calc(100vw - 24px));`
- Hàng chưa đọc: `background: var(--stitch-primary-surface); box-shadow: inset 3px 0 0 var(--stitch-primary);`
- Số chưa đọc: pill 9999px, `background: var(--stitch-primary); color: #fff;`
- Empty state: "Chưa có thông báo mới" + icon bell muted (Stitch suggestion #3).
- Chuông hiển thị cho cả DOCTOR và PATIENT (`PortalChrome`), admin dùng panel tương tự trong admin chrome.
