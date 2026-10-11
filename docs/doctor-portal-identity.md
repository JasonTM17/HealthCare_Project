# Danh tính trên cổng bác sĩ

Thanh đầu trang của các trang bác sĩ lấy tên chuyên môn từ hồ sơ liên kết trả
về bởi `GET /api/v1/doctor/profile`. Email và quyền truy cập vẫn thuộc phiên
đăng nhập hiện tại. Tên tài khoản và tên chuyên môn có thể khác nhau; chuyển
từ Tổng quan sang Kế hoạch, Thông báo hoặc Hồ sơ không thay đổi bác sĩ.

`PortalChrome` chịu trách nhiệm hiển thị này trên mọi trang. Cache ảnh không
được ngăn tải tên hồ sơ. Khi đang tải, thanh đầu trang ghi “Đang tải hồ sơ
bác sĩ…”. Nếu không lấy được hồ sơ, nó dùng tên tài khoản đã xác thực. Kết
quả tải hồ sơ/ảnh được gắn với vai trò và mã người dùng, đồng thời bỏ qua
phản hồi sau khi component đã unmount hoặc người dùng thay đổi.

Sửa này không đổi liên kết hồ sơ, dữ liệu người dùng, phiên, email hoặc quyền
truy cập. Admin vẫn quản lý liên kết tài khoản với hồ sơ bác sĩ theo nghiệp
vụ hiện có.

Kiểm thử hồi quy: `tests/e2e/doctor-header-identity.spec.ts` kiểm tra tên tài
khoản khác tên chuyên môn, chuyển trang khi ảnh đã cache, reload, ba độ rộng
375/768/1440, tải chậm và lỗi dịch vụ hồ sơ. Các phản hồi API trong kiểm thử
được mô phỏng; kết quả này không thay thế kiểm chứng phiên bác sĩ thật trên
bản deploy.
# Tạo kế hoạch chăm sóc

Nút **Tạo kế hoạch mới** ở đầu trang đưa bàn phím đến lịch hẹn đủ điều kiện;
nếu ngày đang xem chưa có lịch hẹn, nút đưa đến **Ngày lịch hẹn** để chọn ngày khác.
Kế hoạch vẫn cần gắn đúng lịch hẹn được phân công và có trạng thái hợp lệ.
Nút này không tạo dữ liệu trước khi bác sĩ chọn lịch hẹn, nhập tên/mục tiêu và
bấm **Tạo kế hoạch** trong biểu mẫu. Các kế hoạch đã tạo vẫn hiển thị khi đổi ngày.

Kiểm thử `tests/e2e/doctor-care-plan-create.spec.ts` chạy trang Next thật với
API giả lập: ngày trống, chọn ngày khác, focus, một yêu cầu tạo, tồn tại sau reload
và bố cục 375/768/1440. Bằng chứng này chưa thay thế kiểm chứng backend thật.
