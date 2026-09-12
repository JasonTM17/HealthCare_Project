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
