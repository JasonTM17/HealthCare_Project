# Đề xuất UI/UX khung chat Trợ lý HealthCare (lượt polish kế tiếp)

Trạng thái đã xong trong đợt này: chữ ≥12px, tương phản AA, strip lỗi một hàng,
pill "Gián đoạn" trong header, composer bo góc token. Đề xuất dưới đây là lớp
"đẹp hơn" — làm sau khi bundle mới lên production, theo thứ tự ưu tiên.

## 1. Header gọn như một khung app thật
- Avatar trợ lý bo tròn 36px + chấm trạng thái xanh/lá úa (online / degraded).
- Tiêu đề 1 dòng; subtitle rút còn "Không lưu lịch sử" — phần "Bạn đang dùng
  chế độ khách..." chuyển thành chip có icon đóng, đặt dưới header, dismiss được
  (không chiếm chỗ vĩnh viễn).
- Nút đóng 40px, hover nền trắng 12%.

## 2. Bong bóng hội thoại
- Bong bóng assistant: nền trắng, viền 1px line, bo góc token lớn hơn ở phía
  tự do (16px góc xa, 4px góc sát đuôi) — tạo hướng đọc mà không phá flat-UI.
- Bong bóng người dùng: nền mint đậm hơn 1 bậc, chữ đậm hơn; giới hạn 84% bề
  ngang (hiện 90% làm dòng dài khó đọc).
- Thời gian + provenance gộp một hàng meta duy nhất, chỉ hiện khi hover trên
  desktop, luôn hiện trên mobile.

## 3. Vùng gợi ý (suggested actions)
- Chip chuyển từ khung chữ nhật sang pill 40px, icon mũi tên chỉ khi hover.
- Chỉ hiện tối đa 3 chip + nút "Xem thêm" — đang hiển thị tất cả làm panel dài.

## 4. Composer
- Textarea tự cao tối đa 3 dòng (hiện ~5 dòng) để panel không bị chiếm chỗ.
- Nút gửi tròn 44px nằm sát mép phải trong khung textarea (kiểu app nhắn tin),
  disabled khi draft < 2 ký tự kèm tooltip lý do.

## 5. Trạng thái hệ thống
- Strip lỗi: giữ dạng một hàng; thêm icon chấm than tròn 16px trước tiêu đề.
- Đang xử lý: dots + copy theo stage đã có — thêm elapsed giây ("đang kết nối…
  4s") để người dùng biết hệ thống còn sống.

## 6. Không làm
- Không thêm dark mode (site chưa có hệ thống token tối).
- Không đổi màu thương hiệu teal-800 của header.
- Không thêm animation mới ngoài typing dots (đã có prefers-reduced-motion).

Thứ tự thực hiện đề xuất: 2 → 4 → 1 → 3 → 5 (mỗi mục một commit, chạy e2e
floating-assistant + flat-ui contract sau mỗi mục).
