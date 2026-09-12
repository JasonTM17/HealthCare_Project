# Original User Request

## 2026-09-12T12:33:49Z

Thực hiện kiểm thử tải áp lực (Load & Stress Test) xác định giới hạn chịu tải của Backend Container trên Render Free, duy trì cơ chế đánh thức ngầm thông minh (BackendWarmup) tiết kiệm quota 750h/tháng, đồng thời rà soát và hoàn thiện toàn bộ giao diện và luồng nghiệp vụ trên toàn hệ thống HealthCare Platform.

Working directory: d:\HealthCare_Project
Integrity mode: development

## Requirements

### R1. Intelligent Cold-Start Warm-up & Quota Preservation
Duy trì cơ chế đánh thức ngầm chủ động (<BackendWarmup />) từ phía Frontend ngay khi người dùng truy cập trang, bảo tồn ngân sách 750 giờ/tháng của Render Free tier (cho phép container tự ngủ đông sau 15 phút không có request), đồng thời duy trì phản hồi tiến trình mượt mà ("Đang kết nối (máy chủ đang khởi động lại)...") để người dùng không gặp cảm giác gián đoạn hay lỗi 504.

### R2. Comprehensive Load & Concurrency Stress Test
Xây dựng và thực thi kịch bản kiểm thử tải áp lực (Stress & Concurrency Benchmark) đo lường chính xác hiệu năng của backend container (0.5 vCPU, 512MB RAM, JVM C1 Tiered Compilation):
- Đo lường thông lượng (RPS), độ trễ p50 / p95 / p99 trên các endpoint công khai và bảo mật.
- Kiểm tra sức chịu đựng của HikariCP connection pool và bộ nhớ heap/metaspace dưới áp lực đồng thời, chứng minh 0 lỗi Out-Of-Memory (exit 137).

### R3. Full-Scope UI/UX & Functional Hardening Across All Portals
Rà soát, kiểm toán và tinh chỉnh toàn diện giao diện và trải nghiệm người dùng trên tất cả các phân hệ:
- Cổng công khai: Trang chủ, Tra cứu, Đặt lịch, Chi tiết Bác sĩ, Chuyên khoa, Gói khám, Dịch vụ, Bài viết y khoa.
- Cổng người dùng: Cổng bệnh nhân (Dashboard, Lịch hẹn, Hồ sơ bệnh án, Toa thuốc, Chatbot AI), Cổng bác sĩ (Lịch khám, Quản lý tư vấn), Cổng quản trị viên.
- Đảm bảo tính nhất quán về typography (Be Vietnam Pro), khoảng cách, màu sắc y tế chuẩn, không có liên kết hỏng (dead links) hay phần tử unstyled.

## Acceptance Criteria

### Performance & Resilience
- [ ] Báo cáo tải định lượng chi tiết: xác định rõ ngưỡng RPS tối đa an toàn và độ trễ phản hồi khi máy chủ ấm đạt dưới 250ms.
- [ ] Không phát sinh lỗi OOM crash hay rò rỉ bộ nhớ (JVM heap duy trì ổn định dưới 200MB trong suốt quá trình stress test).
- [ ] Luồng thức dậy cold-start không gây timeout (BFF timeout 25s, client 28s hoạt động trơn tru).

### System Quality & Tests
- [ ] 100% test suites hiện có (295 frontend tests và các backend tests) giữ vững trạng thái PASS.
- [ ] Tất cả các trang thuộc Portal Bệnh nhân, Bác sĩ, Quản trị viên đạt chuẩn hiển thị responsive trên cả Desktop và Mobile.

## 2026-09-12T14:46:56Z

Dự án tối ưu và hoàn thiện toàn diện 4 luồng trải nghiệm trọng yếu của hệ thống HealthCare theo phản hồi thực tế của người dùng:
1. Cổng Chat AI Bệnh nhân (/patient/chat): Ổn định khung nhập câu hỏi, sửa lỗi cuộn lịch sử, kết nối thông suốt DeepSeek RAG và chuẩn hóa cơ chế trừ lượt (quota).
2. Trang Tìm kiếm (/search): Xóa bỏ banner cảnh báo đỏ gây hiểu lầm khi dữ liệu đã có kết quả.
3. Luồng Đặt lịch khám (/dat-lich): Sửa triệt để lỗi giữ chỗ ở Bước 3 và hoàn thiện toàn bộ hành trình đến màn hình Thành công / Mã phiếu khám.
4. Luồng Đặt Gói khám sức khỏe (/packages): Tách biệt form đặt gói khám riêng, đồng bộ nút đặt lịch trên mọi gói và loại bỏ bắt buộc chọn chuyên khoa đối với người khám tổng quát.

Working directory: d:\HealthCare_Project
Integrity mode: development

## Requirements

### R1. Sửa lỗi & Hoàn thiện Cổng Chat AI Bệnh nhân (/patient/chat)
- Khung nhập liệu luôn sẵn sàng: Khắc phục lỗi khung nhập câu hỏi (textarea và nút gửi) bị ẩn hoặc không xuất hiện khi người dùng mở phiên chat mới hoặc chuyển đổi giữa các phiên hội thoại.
- Cuộn lịch sử hội thoại mượt mà: Sửa lỗi cấu trúc CSS/flex layout khiến danh sách các cuộc trò chuyện cũ ở sidebar và danh sách tin nhắn trong khung chat không thể cuộn (scroll) để xem lại nội dung cũ.
- Kết nối thông suốt AI & Tránh fallback rỗng: Khắc phục lỗi "Trợ lý chưa phản hồi tin nhắn này"; đảm bảo tín hiệu trao đổi với AI Service (mô hình DeepSeek RAG) được kết nối ổn định, hiển thị câu trả lời y tế hữu ích cho người bệnh.
- Chuẩn hóa cơ chế tính hạn ngạch (Quota): Không trừ lượt hỏi AI khi người dùng mới bấm tạo phiên trò chuyện rỗng hoặc khi kết nối gặp lỗi. Chỉ trừ hạn ngạch chính xác 1 lượt sau khi AI đã hoàn tất phản hồi thành công cho người dùng.

### R2. Khắc phục cảnh báo mở rộng tìm kiếm (/search)
- Khử bỏ banner cảnh báo đỏ không cần thiết: Khi người dùng tìm kiếm từ khóa (ví dụ "Tim mạch"), hệ thống đã tìm thấy 133 kết quả phù hợp nhưng lại văng thông báo cảnh báo đỏ: "Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau". Cần xử lý triệt để nguyên nhân (do sub-query phụ hoặc cold-start) và chỉ hiển thị banner khi toàn bộ tìm kiếm thực sự thất bại.
- Trải nghiệm tìm kiếm liền mạch: Kết quả tìm kiếm hiển thị nhanh chóng, gọn gàng, trạng thái tải và thông báo lỗi êm ái, không làm người dùng hoang mang.

### R3. Hoàn tất & Tăng độ tin cậy Luồng Đặt lịch (/dat-lich)
- Khắc phục lỗi giữ chỗ ở Bước 3: Xử lý triệt để thông báo lỗi "Không thể kết nối với hệ thống đặt lịch. Khung giờ chưa được giữ; vui lòng thử lại" khi người dùng hoàn thành bước điền thông tin liên hệ. Đảm bảo API giữ chỗ (hold slot) kết nối ổn định với backend.
- Hoàn thiện trọn vẹn luồng đặt khám (Bước 1 đến Bước 4): Đảm bảo người dùng đi thông suốt từ Chọn nhu cầu -> Chọn cơ sở & khung giờ -> Điền thông tin liên hệ -> Xác nhận mã OTP -> Màn hình Đặt lịch thành công kèm Mã phiếu khám và hướng dẫn đến khám.

### R4. Tách biệt & Tối ưu luồng Đặt lịch cho Gói khám (/packages)
- Đồng bộ nút đặt lịch trên 100% gói khám: Khắc phục tình trạng một số gói khám trong trang chi tiết (/packages/[slug]) có nút "Đặt lịch với gói này" trong khi một số gói khác lại bị thiếu nút.
- Tách biệt luồng Đặt Gói Khám riêng (Custom Booking Flow): 
  - Khắc phục sự bất hợp lý hiện tại: Người dùng đi khám gói tổng quát / tầm soát định kỳ chưa biết mình có bệnh gì, nhưng form đặt lịch lại bắt buộc phải chọn "Chuyên khoa".
  - Khi người dùng bấm "Đặt lịch với gói này" (tại trang danh mục hoặc chi tiết gói khám), mở form/modal chuyên biệt cho Gói khám:
    * Gói khám đã được tự động chọn sẵn và cố định.
    * Bỏ qua hoàn toàn bước "Chọn chuyên khoa bệnh lý".
    * Người dùng chỉ cần: (1) Chọn Cơ sở y tế thuận tiện, (2) Chọn Ngày & Khung giờ tiếp nhận, (3) Điền thông tin người khám và (4) Nhận mã xác nhận đặt lịch.

## Acceptance Criteria

### Cổng Chat AI Bệnh nhân (/patient/chat)
- [ ] Khung nhập tin nhắn (textarea) luôn hiển thị rõ ràng và tương tác tốt trong mọi trạng thái của phiên trò chuyện.
- [ ] Danh sách các cuộc trò chuyện cũ ở sidebar và khung nội dung tin nhắn đều cuộn được mượt mà trên cả desktop và mobile.
- [ ] Gửi câu hỏi nhận được câu trả lời từ AI DeepSeek, không còn xuất hiện thông báo lỗi "Trợ lý chưa phản hồi tin nhắn này".
- [ ] Hạn ngạch AI (quota) chỉ trừ đúng 1 lượt khi tin nhắn hoàn tất phản hồi, không bị hao hụt khi tạo phiên rỗng.

### Trang Tìm kiếm (/search)
- [ ] Tìm kiếm từ khóa hợp lệ (ví dụ "Tim mạch", "Nhi khoa") hiển thị danh sách kết quả đầy đủ mà không xuất hiện banner cảnh báo đỏ "Tạm thời chưa thể mở rộng...".
- [ ] Các bộ lọc kết quả (Chuyên khoa, Bác sĩ, Gói khám, Dịch vụ) hoạt động chính xác.

### Luồng Đặt lịch Khám chung (/dat-lich)
- [ ] Bước 3 (Điền thông tin) kết nối thành công với hệ thống giữ chỗ, không còn văng cảnh báo "Khung giờ chưa được giữ".
- [ ] Luồng đặt lịch hoàn tất đầy đủ 4 bước, gửi OTP và hiển thị màn hình Thành công với Mã đặt lịch rõ ràng.

### Luồng Đặt Gói Khám Sức Khỏe (/packages)
- [ ] 100% các gói khám tại danh mục và trang chi tiết đều có nút "Đặt lịch với gói này".
- [ ] Luồng đặt gói khám tự động gắn đúng gói, không ép buộc người dùng phải chọn chuyên khoa khám bệnh lý, hoàn tất đặt gói trơn tru.

### Tiêu chuẩn Kỹ thuật & Kiểm thử
- [ ] Toàn bộ unit tests trong apps/frontend đạt 100% PASS (npm test).
- [ ] TypeScript typecheck và Lint đạt 0 lỗi (npm run typecheck, npm run lint).
- [ ] Kịch bản kiểm thử tự động Playwright E2E mô phỏng hành vi người dùng trên trình duyệt xác nhận cả 4 luồng hoạt động hoàn hảo.

## 2026-09-12T15:47:37Z

Toàn bộ kiểm thử Backend (78/78 tests) và Frontend (319/319 tests) đã đạt PASS 100%. TypeScript typecheck và ESLint đạt 0 lỗi. Vui lòng hoàn tất nghiệm thu và tổng hợp báo cáo kết thúc Sentinel.
