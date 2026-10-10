# Đề xuất UI/UX khung chat Trợ lý HealthCare (lượt polish kế tiếp)

Định dạng tin nhắn dùng chung cho khung nổi và lịch sử: các dấu `•` nằm trong
đoạn văn trở thành từng dòng; nhãn giá, đối tượng, số ngày và dịch vụ được làm
đậm và tách mục. Đây là cách hiển thị, không sửa nội dung đã lưu hay số tiền.
Liên kết nguồn, Markdown và ví dụ mã vẫn được hiển thị an toàn. Trên điện thoại,
nút Trợ lý AI trong đầu trang bệnh nhân mở cùng khung trợ lý; nút nổi khi đóng
được ẩn để không che nội dung. Thanh điều hướng có nút cuộn và hỗ trợ bàn phím.

Khung chat bệnh nhân trên màn hình nhỏ xếp danh sách và hội thoại thành hai
hàng tự cao; giới hạn chiều cao của workspace chỉ áp dụng cho desktop. Nút
Tạo mới và khung soạn tin không chồng nhau. Nhãn tính phí nói rõ phản hồi
tính phí dùng một lượt, hướng dẫn miễn phí dùng không lượt; chỉ trừ khi phản
hồi tính phí hoàn tất thành công. Không thay đổi cách tính lượt ở backend.

Các ý tưởng polish dưới đây chưa được chấp nhận để triển khai và không phải
bằng chứng production hoặc kiểm chứng tương phản. Xem vận hành chatbot trong
[frontend README](../apps/frontend/README.md).

## 1. Header gọn như một khung app thật
- Avatar trợ lý bo tròn 36px + chấm trạng thái xanh/lá úa (online / degraded).
- Tiêu đề 1 dòng; subtitle rút còn "Không lưu lịch sử" — phần "Bạn đang dùng
  chế độ khách..." chuyển thành chip có icon đóng, đặt dưới header, dismiss được
  (không chiếm chỗ vĩnh viễn).
- Nút đóng tối thiểu44px và không bị flex co; hover nền trắng 12%.

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
- Đang xử lý: copy trung tính theo thời gian chờ; chỉ nêu bước tra cứu/kết nối
  khi có tín hiệu tương ứng từ server. Không suy ra tiến độ mô hình từ timer.

## 6. Không làm
- Không thêm dark mode (site chưa có hệ thống token tối).
- Không đổi màu thương hiệu teal-800 của header.
- Không thêm animation mới ngoài typing dots (đã có prefers-reduced-motion).

Thứ tự thực hiện đề xuất: 2 → 4 → 1 → 3 → 5 (mỗi mục một commit, chạy e2e
floating-assistant + flat-ui contract sau mỗi mục).
