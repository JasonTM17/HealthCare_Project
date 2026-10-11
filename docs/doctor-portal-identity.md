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
