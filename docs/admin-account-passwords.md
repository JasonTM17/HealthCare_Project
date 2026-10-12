# Quản lý mật khẩu tài khoản

Mở [Quản lý tài khoản](https://www.healthcare.id.vn/admin/users) bằng tài khoản quản trị hợp lệ. Tạo tài khoản vẫn cần quy trình xác minh email; việc cấp mật khẩu không phải bằng chứng người nhận sở hữu email.

Admin có thể đặt mật khẩu mới cho bác sĩ và bệnh nhân khác. Đây là thao tác hỗ trợ có thể kết thúc phiên đang sử dụng của người nhận; trao đổi với chủ tài khoản trước và chuyển mật khẩu qua kênh riêng phù hợp. Tài khoản quản trị và tài khoản trải nghiệm dùng luồng bảo vệ riêng.

Quyền và tính nguyên tử thuộc `AdminAccountService.setPassword` và `AccountGovernance`, chính sách đầu vào thuộc `AdminAccountPasswordRequest`, audit thuộc migration `V123__admin_direct_password_audit.sql`. Giao diện thuộc `AdminPasswordForm`; kiểm chứng bằng các ca password trong `AdminAccountIntegrationTest` và `AdminAccountGovernanceConcurrencyTest`.

“Yêu cầu đặt lại mật khẩu” qua email và “Đổi mật khẩu trực tiếp” phục vụ hai tình huống khác nhau. Không coi việc gửi yêu cầu email là bằng chứng đã đổi mật khẩu hoặc đã nhận email.
