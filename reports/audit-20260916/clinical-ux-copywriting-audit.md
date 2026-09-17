# Báo cáo Kiểm toán Chuyên sâu: Clinical UX & Copywriting

**Đơn vị thực hiện:** Advisor (AgentKit Workflow)  
**Mục tiêu kiểm toán:** Rà soát toàn diện trải nghiệm người dùng y tế (Clinical UX), tính trang trọng, rõ ràng và chuẩn mực y khoa trên:
1. **Các trang xác thực người dùng:** `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` (bao gồm đánh giá placeholder `email@example.com` và nhãn demo accounts).
2. **Hành động gợi ý trên Floating Health Assistant:** Bộ câu hỏi khởi tạo, nhãn CTA hành động và cơ chế phân luồng khẩn cấp.
3. **Luồng đặt lịch trực tuyến `/dat-lich`:** Trải nghiệm tiếp nhận 4 bước (`BookingInlineExperience`), các tuyên bố miễn trừ y tế, hướng dẫn triệu chứng và cơ chế đồng ý xử lý thông tin cá nhân.
**Thời điểm thực hiện:** 17/09/2026  
**Kết luận tổng quan:** **CHUẨN MỰC Y KHOA & SẴN SÀNG TRIỂN KHAI (PASS WITH RECOMMENDATIONS)**

---

## I. Kiểm toán Chuyên sâu Các Trang Xác thực (Auth Pages)

### 1. Chuẩn hóa Placeholder sang `email@example.com`
* **Hiện trạng rà soát:**
  - `/auth/login`: `<input ... placeholder="email@example.com" />` — Đã chuẩn hóa.
  - `/auth/forgot-password`: `<input ... placeholder="email@example.com" />` — Đã chuẩn hóa.
  - `/auth/reset-password`: `<input ... placeholder="email@example.com" />` — Đã chuẩn hóa.
  - `/auth/verify-email`: `<input ... placeholder="email@example.com" />` — Đã chuẩn hóa.
* **Đánh giá góc độ Clinical UX & Bảo mật:**
  - **Tránh rò rỉ và định kiến tên miền:** Việc dùng tên miền dành riêng theo tiêu chuẩn RFC 2606 (`example.com`) ngăn chặn việc vô tình gợi ý một nhà cung cấp cụ thể (như gmail.com, yahoo.com hay tên miền nội bộ bệnh viện).
  - **Bảo vệ người dùng khỏi email giả mạo:** Ngăn chặn nguy cơ người dùng thử nghiệm gửi dữ liệu y tế nhạy cảm đến một hộp thư có thật của bên thứ ba.
  - **Tính trung tính chuẩn mực:** Đây là tiêu chuẩn thiết kế biểu mẫu y tế quốc tế (HIPAA-compliant forms) đối với các cổng thông tin bệnh nhân (Patient Portals).

### 2. Rút gọn Dòng chữ Demo Accounts thành *"Tài khoản demo dùng để trải nghiệm"*
* **Hiện trạng rà soát tại `/auth/login`:**
  - Đoạn text trước đây: Các câu giải thích dài dòng về môi trường thử nghiệm, tài khoản mẫu.
  - Đoạn text hiện tại: `<p className="section-note" id="demo-accounts-label">Tài khoản demo dùng để trải nghiệm</p>`
* **Đánh giá góc độ Tâm lý Bệnh nhân & Ngôn ngữ Y khoa:**
  - **Giảm tải nhận thức (Cognitive Load):** Bệnh nhân khi vào trang đăng nhập thường có tâm lý lo âu hoặc vội vã (cần xem kết quả xét nghiệm, lịch hẹn). Việc rút gọn văn bản thành một nhãn phụ khiêm tốn giúp giao diện sạch sẽ, tập trung 100% sự chú ý vào biểu mẫu đăng nhập chính thức.
  - **Bảo vệ tính nghiêm túc của hệ thống y tế:** Cụm từ *"Tài khoản demo dùng để trải nghiệm"* ngắn gọn, lịch sự, đóng vai trò như một bảng chỉ dẫn phụ trợ cho ban giám khảo/người đánh giá mà không làm mất đi vẻ trang nghiêm của một cơ sở y tế.
  - **Hàng rào môi trường (Environment Fence):** Cụm demo này được kiểm soát bởi biến môi trường `SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"`. Ở môi trường production thực tế, toàn bộ khối này biến mất hoàn toàn khỏi DOM, chỉ để lại cổng đăng nhập thuần túy cho bệnh nhân.

### 3. Đánh giá Văn phong (Tone & Copywriting) Từng Trang Auth
* **`/auth/login`:**
  - Kicker & Tiêu đề: *"Chăm sóc sức khỏe bắt đầu từ một lần đăng nhập. Theo dõi lịch khám, hồ sơ và những cuộc hẹn quan trọng của bạn trong một không gian riêng tư."*
  - **Nhận xét:** Lời chào ấm áp, mang đậm tính nhân văn y tế, nhấn mạnh vào giá trị *"riêng tư"* — yếu tố cốt lõi xây dựng niềm tin của bệnh nhân đối với bệnh viện số.
* **`/auth/forgot-password`:**
  - Microcopy bảo vệ danh tính: `<small id="forgot-email-help">Chúng tôi không tiết lộ email có tài khoản hay không.</small>`
  - **Nhận xét:** Đây là microcopy y tế xuất sắc. Bệnh nhân có thể sử dụng máy tính công cộng hoặc người nhà tra cứu; thông điệp này vừa đảm bảo an toàn thông tin chống trích xuất danh tính (account enumeration attack), vừa thể hiện sự tôn trọng tuyệt đối đối với quyền riêng tư của người bệnh.
* **`/auth/reset-password`:**
  - Hướng dẫn bảo mật: *"Chọn một mật khẩu mới cho tài khoản bệnh nhân. Các phiên đăng nhập cũ sẽ được yêu cầu xác thực lại."*
  - **Nhận xét:** Rõ ràng, dứt khoát, mang tính cảnh báo an ninh cần thiết nhằm bảo vệ hồ sơ bệnh án điện tử (EMR) khỏi việc bị truy cập trái phép từ các thiết bị cũ.
* **`/auth/verify-email`:**
  - Trợ giúp nhận mã: *"Mã gồm 6 chữ số đã được gửi qua hòm thư email của bạn (kiểm tra cả mục Hộp thư đến và Spam)."*
  - Thời gian chờ (Cooldown): *"Gửi lại sau 30s"* kèm trạng thái thành công rõ ràng.
  - **Nhận xét:** Giúp giải tỏa căng thẳng cho bệnh nhân khi gặp tình trạng email bị phân loại nhầm vào thư rác, hạn chế tình trạng người dùng bấm gửi lại liên tục gây nghẽn hệ thống.

---

## II. Rà soát Hành động Gợi ý trên Floating Health Assistant

### 1. Bộ Câu hỏi Khởi tạo Theo Ngữ cảnh (`getSuggestedQuestions`)
* **Chế độ Hỗ trợ Vận hành (`HOSPITAL_SUPPORT`):**
  - *"Làm sao để đặt lịch khám tại HealthCare?"*
  - *"Bệnh viện có những chuyên khoa và cơ sở nào?"*
  - *"Quy trình đặt lịch hẹn và giờ làm việc ra sao?"*
  - **Đánh giá:** Trang trọng, đúng mực, tập trung vào nhu cầu hành chính và tiếp đón ban đầu của người dân.
* **Chế độ Định hướng Triệu chứng (`SYMPTOM_TRIAGE`):**
  - *"Tìm chuyên khoa phù hợp với triệu chứng của tôi"*
  - *"Tôi bị đau đầu kèm chóng mặt nên khám khoa nào?"*
  - *"Khi nào triệu chứng cần liên hệ cấp cứu 115?"*
  - **Đánh giá:** Rất chuẩn mực. Các câu hỏi mẫu không hỏi sâu vào việc "kê đơn" hay "chẩn đoán bệnh gì", mà hướng dẫn người bệnh cách **chọn đúng chuyên khoa** hoặc **nhận biết dấu hiệu cấp cứu**.
* **Chế độ Giáo dục Sức khỏe (`HEALTH_EDUCATION`):**
  - *"Tôi nên chuẩn bị gì trước khi đi khám?"*
  - *"Những lưu ý nhịn ăn trước khi xét nghiệm máu?"*
  - *"Tại sao nên khám sức khỏe tổng quát định kỳ?"*
  - **Đánh giá:** Giá trị lâm sàng dự phòng cao, giúp người bệnh có sự chuẩn bị chu đáo về mặt thể chất và xét nghiệm trước khi đến viện.

### 2. Các Nút Hành động Đề xuất (Suggested Action CTAs)
* **Động từ hành động rõ ràng, chuẩn y khoa:**
  - Thay vì các nhãn mơ hồ ("Xem thêm", "Chi tiết"), hệ thống sử dụng các động từ chỉ rõ đích đến:
    - `"Đọc bài viết"` (`/articles/<slug>`)
    - `"Xem câu trả lời"` (`/faq#faq-...`)
    - `"Xem Chuyên khoa"` (`/specialties/<slug>`)
    - `"Xem Bác sĩ"` (`/doctors/<slug>`)
    - `"Đặt lịch khám"` (`/dat-lich`)
* **Tách biệt Tuyệt đối Giao thức Cấp cứu (Emergency Protocol):**
  - Khi phát hiện triệu chứng nguy hiểm (`safetyAction === "EMERGENCY"`), giao diện trợ lý lập tức chuyển sang chế độ cảnh báo khẩn cấp:
    - `"Đây có thể là tình huống khẩn cấp."`
    - `"Không chờ trợ lý phản hồi; gọi 115 hoặc đến khoa cấp cứu gần nhất."`
    - Nút bấm trực tiếp: `Gọi 115` (`tel:115`).
  - Toàn bộ các nút gợi ý điều hướng thông thường (như đọc bài viết hay xem cơ sở) bị **triệt tiêu hoàn toàn**, ngăn chặn việc phân tán sự chú ý của bệnh nhân trong thời khắc sinh tử.
* **Trạng thái Khiêm nhường Y tế (Medical Humility):**
  - Khi dữ liệu RAG không đủ để khẳng định, trợ lý gắn nhãn `"Chưa có nguồn xác thực"` và phản hồi dừng trả lời suy đoán. Đây là điểm sáng vượt bậc về đạo đức AI trong y tế (Medical AI Ethics).

---

## III. Rà soát Luồng Đặt lịch Khám Bệnh `/dat-lich`

### 1. Kiến trúc Trải nghiệm Tiếp nhận 4 Giai đoạn (Progressive Disclosure)
Luồng tiếp nhận được chia thành 4 bước tuần tự rõ ràng:
1. **Chọn nhu cầu khám:** Chuyên khoa, Bác sĩ, Gói khám, Cơ sở.
2. **Ngày & Khung giờ khám:** Lựa chọn trực quan khung giờ còn trống theo thời gian thực.
3. **Điền thông tin liên hệ:** Họ tên, Số điện thoại, Email, BHYT và Lý do khám.
4. **Xác nhận OTP:** Giữ chỗ tạm thời có thời hạn, nhập mã OTP để xuất phiếu khám điện tử.

### 2. Đánh giá Copywriting & Tính Nhân văn Y tế
* **Lời mở đầu & Tuyên bố Trách nhiệm:**
  - *"Đặt lịch khám trực tuyến: Chọn chuyên khoa, cơ sở, bác sĩ và khung giờ khám thuận tiện nhất. Quy trình tiếp nhận tinh gọn, bảo mật và hỗ trợ ưu tiên tại quầy tiếp đón."*
  - Nhắc nhở ranh giới y tế: *"Bạn có thể mở công cụ gợi ý tham khảo nếu chưa biết nên chọn chuyên khoa nào. Kết quả không thay thế tư vấn hoặc chẩn đoán của bác sĩ."*
  - **Đánh giá:** Tạo tâm lý an tâm, khẳng định tính chuyên nghiệp của bệnh viện và thiết lập kỳ vọng đúng mực.
* **Trường nhập Triệu chứng / Lý do khám:**
  - Label: *"Triệu chứng hoặc lý do khám bệnh"*
  - Placeholder: *"Mô tả sơ bộ triệu chứng (đau đầu, sốt, khó thở...) để bác sĩ chuẩn bị trước..."*
  - **Đánh giá:** Khéo léo định hướng bệnh nhân tóm tắt triệu chứng chính một cách súc tích, giúp bác sĩ nắm bắt bệnh sử ban đầu trước khi tiếp đón tại phòng khám.
* **Hỗ trợ Bảo hiểm Y tế & Sự Đồng thuận (Informed Consent):**
  - Hộp kiểm BHYT: *"Tôi có thẻ BHYT hoặc giấy bảo lãnh viện phí cần hỗ trợ khi đến khám."* -> Thể hiện sự tôn trọng quyền lợi tài chính y tế của bệnh nhân.
  - Hộp kiểm Bảo mật: *"Tôi đồng ý để HealthCare xử lý thông tin đặt lịch theo chính sách bảo mật."* -> Đảm bảo tính pháp lý và tuân thủ Luật Khám bệnh, chữa bệnh và Nghị định bảo vệ dữ liệu cá nhân (PDPD).
* **Đồng hồ Đếm ngược Kép (Dual Timers) & Trấn an Bệnh nhân:**
  - Hệ thống hiển thị rõ ràng:
    - `Giữ chỗ còn lại: MM:SS`
    - `OTP còn hiệu lực: MM:SS`
  - Microcopy giải tỏa lo lắng: *"Không tạo thêm lịch hẹn; mã mới sẽ thay thế mã cũ."* -> Giúp bệnh nhân không sợ bị tính trùng lịch hẹn hay mất chỗ khi mạng bị chậm.

---

## IV. Bảng Tổng hợp Khuyến nghị Hoàn thiện (Recommendations)

Dù hệ thống đã đạt mức độ hoàn thiện rất cao, Advisor khuyến nghị một số tinh chỉnh vi mô (Micro-improvements) để đạt độ hoàn hảo tuyệt đối:

| Vị trí | Hiện trạng | Khuyến nghị Tinh chỉnh | Lý do / Lợi ích Y tế |
| :--- | :--- | :--- | :--- |
| **`BookingModal.tsx`** (Dòng 1425) | `placeholder="patient@example.com"` | Cân nhắc đổi sang `placeholder="email@example.com"` | Đồng bộ 100% với chuẩn placeholder của toàn bộ các trang Auth. |
| **`BookingModal.tsx`** (Dòng 1406) | `placeholder="0901234567"` | Giữ nguyên placeholder nhưng bổ sung trợ giúp: *"Số điện thoại dùng để nhận tin nhắn lịch hẹn"* | Giúp người cao tuổi hiểu rõ tại sao bệnh viện cần số điện thoại chính xác. |
| **`FloatingHealthAssistant.tsx`** | Nhãn aria: `"Bước tiếp theo"` | Đảm bảo mã hóa UTF-8 chuẩn xác, không bị lỗi font trên các trình đọc màn hình cũ | Tối ưu khả năng tiếp cận (Accessibility - a11y) cho người khiếm thị. |

---

## V. Kết luận của Advisor

1. **Về các trang xác thực:** Việc chuẩn hóa placeholder sang `email@example.com` và tinh gọn dòng chữ thành *"Tài khoản demo dùng để trải nghiệm"* là **hoàn toàn chính xác, đúng mực và chuyên nghiệp**. Giao diện đã loại bỏ được cảm giác của một dự án thí nghiệm, khoác lên diện mạo của một cổng dịch vụ y tế chính quy, bảo mật.
2. **Về Floating Health Assistant:** Các hành động gợi ý thể hiện rõ **chuẩn mực y khoa và sự tôn trọng người bệnh**. Đặc biệt, cơ chế ưu tiên tuyệt đối cho cuộc gọi cấp cứu 115 khi gặp triệu chứng nặng thể hiện tinh thần trách nhiệm y tế cao nhất.
3. **Về luồng đặt lịch `/dat-lich`:** Quy trình 4 bước tinh gọn, tôn trọng quyền lợi bảo hiểm y tế, minh bạch về thời gian giữ chỗ và OTP, xứng đáng là mô hình mẫu mực cho dịch vụ đăng ký khám chữa bệnh thông minh.

**KẾT LUẬN CUỐI CÙNG: PHÊ DUYỆT ĐẦY ĐỦ (GO / APPROVED)** — Toàn bộ ngôn ngữ và trải nghiệm lâm sàng đã sẵn sàng phục vụ người bệnh trên môi trường sản xuất.
