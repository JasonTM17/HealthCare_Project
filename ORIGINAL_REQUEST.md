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

## 2026-09-12T16:18:46Z

# Teamwork Project Prompt

Dự án nâng cấp toàn diện giao diện Bài viết Y khoa chuẩn tạp chí chuyên môn cao cấp (Editorial Medical Journal) và xây dựng khu vực Thảo luận / Hỏi đáp cộng đồng chuẩn Diễn đàn y khoa (Medical Community Forum & Q&A Discussion Thread) trên nền tảng HealthCare.

Working directory: d:\HealthCare_Project
Integrity mode: development

## Requirements

### R1. Thiết kế Giao diện Bài báo Y khoa Chuẩn Tạp chí Cao cấp (Editorial Medical Journal Layout)
- **Cấu trúc Tiêu đề & Sa-pô bài viết**: Tiêu đề ngắt dòng hài hòa (`text-wrap: balance`), sa-pô mở đầu trang trọng với đường kẻ điểm nhấn thương hiệu y tế (`border-l-4 border-teal-600`), font chữ toát lên sự tin cậy, khoa học và đĩnh đạc.
- **Bảo chứng chuyên môn & Metadata bài báo**: Cụm thông tin tác giả bác sĩ, ngày xuất bản, ngày cập nhật phác đồ điều trị và thời lượng đọc hiển thị dạng inline phẳng, tinh tế, không gò bó viền hộp, có huy hiệu xác thực chuyên môn y tế (Peer-reviewed).
- **Mục lục thông minh & Bố cục đọc 2 cột**: Bố cục 2 cột (Nội dung chính và Sidebar điều hướng) tương thích hoàn hảo từ màn hình lớn (Desktop 1440px) đến tablet và mobile. Mục lục hỗ trợ nhảy nhanh đến các đề mục và khối điểm cần nhớ.
- **Khối trích dẫn & Cảnh báo y tế cấp cứu**: Khối "Điểm cần nhớ", "Khi nào nên đi khám" và "Cảnh báo cấp cứu 115" thiết kế đồng bộ theo hệ thống Flat UI design tokens, tạo độ chú ý cao nhưng không gây hoang mang cho người bệnh.

### R2. Diễn đàn Thảo luận & Hỏi đáp Y khoa Chuyên nghiệp (Medical Forum & Q&A Discussion Thread)
- **Tích hợp khu vực thảo luận cuối bài báo**: Nhúng và tối ưu hóa phân hệ thảo luận `ArticleComments` ngay dưới chân mỗi bài viết (`/articles/[slug]`).
- **Giao diện dạng luồng thảo luận diễn đàn (Threaded Discussion Forum)**:
  - Phân tầng trực quan: Câu hỏi của độc giả / bệnh nhân hiển thị rõ ràng, câu trả lời lồng nhau (nested replies) có thanh chỉ dẫn phân cấp thread chuẩn diễn đàn.
  - Nhận diện phản hồi Bác sĩ: Câu trả lời của Bác sĩ được làm nổi bật với thẻ nền y tế trang nhã, viền điểm nhấn Teal, huy hiệu `🩺 Bác sĩ chuyên khoa xác thực` kèm chuyên khoa để người đọc phân biệt ngay với bình luận của người dùng thông thường.
  - Khung đặt câu hỏi (Q&A Composer): Thiết kế như diễn đàn y khoa quốc tế, đếm ký tự, hướng dẫn hỏi đáp văn minh, kèm hộp mời đăng nhập trang nhã cho bạn đọc chưa đăng nhập.

### R3. Chuẩn hóa Frontend, Design Tokens & Khả năng tiếp cận (FE Quality & A11y)
- **Kỷ luật Flat UI Tokens**: 100% tuân thủ token phẳng của dự án (`border-radius: var(--radius-sm, 2px)`, không lạm dụng bo góc cong lớn hay hiệu ứng bóng đổ mờ nhòe).
- **Khả năng tiếp cận WCAG 2.1 AA**: Tỷ lệ tương phản màu văn bản đạt chuẩn ≥ 4.5:1, kích thước vùng chạm cảm ứng tối thiểu 44×44px, hỗ trợ bàn phím (`focus-visible`) và screen reader đầy đủ.
- **Bảo toàn kiểm thử & Không phát sinh hồi quy**: 100% unit test (`npm test --prefix apps/frontend`) đạt kết quả PASS xanh (319/319 tests), TypeScript typecheck đạt 0 lỗi.

## Acceptance Criteria

### Giao diện Bài báo Y khoa (Editorial Medical Journal)
- [ ] Tiêu đề và sa-pô bài viết `/articles/[slug]` hiển thị sang trọng, chuẩn tạp chí y khoa quốc tế.
- [ ] Cụm metadata (Tác giả, Ngày xuất bản, Phác đồ cập nhật, Thời lượng) hiển thị inline phẳng, thoáng mắt, không bị viền hộp gò bó.
- [ ] Khối mục lục, điểm cần nhớ và cảnh báo y tế 115 có phân cấp thị giác rõ ràng, đọc tốt trên cả mobile và desktop.

### Khu vực Thảo luận Diễn đàn (Forum Discussion & Q&A)
- [ ] Cuối bài viết xuất hiện khu vực "Hỏi đáp & Thảo luận y khoa" tích hợp đầy đủ API lấy và gửi bình luận.
- [ ] Phản hồi từ Bác sĩ (`authorRole: "DOCTOR"`) có huy hiệu xác thực và màu nhận diện chuyên môn riêng biệt, nổi bật so với câu hỏi thông thường.
- [ ] Hỗ trợ trả lời lồng nhau (nested reply) trơn tru, hiển thị dạng thread diễn đàn chuyên nghiệp.
- [ ] Người dùng chưa đăng nhập nhìn thấy lời nhắc lịch sự và link đăng nhập nhanh.

### Kiểm thử & Chất lượng Kỹ thuật
- [ ] Toàn bộ 319 bài test trong `apps/frontend` đạt 100% PASS.
- [ ] TypeScript typecheck (`npm run typecheck`) không có bất kỳ lỗi nào.
- [ ] Kiểm chứng thực tế qua ảnh chụp màn hình trình duyệt xác nhận độ hoàn thiện cao về mặt thẩm mỹ.

## 2026-09-14T09:09:49Z

Nâng cấp toàn diện cơ sở tri thức y khoa Supabase pgvector và thiết lập cơ chế định tuyến lai thông minh (Cost-Saving Hybrid RAG Router), ưu tiên giải đáp chính xác từ kho dữ liệu vector nội bộ và chỉ kích hoạt DeepSeek v4 Flash đối với các câu hỏi triệu chứng phức tạp hoặc nằm ngoài phạm vi tri thức có sẵn để tối ưu hóa chi phí vận hành.

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Làm giàu cơ sở tri thức y tế thực tế trong Supabase Vector DB
- Thay thế hoàn toàn các văn bản giữ chỗ giả lập trong `ai_documents` bằng nội dung y khoa thực tế, chuẩn chỉnh:
  - **30 chuyên khoa lâm sàng**: Tích hợp mô tả bệnh học chuyên sâu, triệu chứng chỉ điểm, quy trình thăm khám, lưu ý chuẩn bị trước khi khám và hướng điều trị cơ bản.
  - **20 chi nhánh bệnh viện**: Bổ sung địa chỉ, số hotline cấp cứu, khung giờ hoạt động, danh mục khoa phòng và tiện ích phục vụ người bệnh.
  - **Cẩm nang bệnh học thường gặp (Clinical Guides)**: Soạn thảo các bài viết y khoa thực tế về Tim Mạch (tăng huyết áp, mạch vành), Tiêu Hóa (dạ dày, trào ngược), Hô Hấp (hen suyễn, viêm phế quản), Nội Tiết (tiểu đường, tuyến giáp), Nhi Khoa và Da Liễu.
  - **Ngân hàng câu hỏi thường gặp (Medical & Hospital FAQs)**: Hướng dẫn chi tiết về bảo hiểm y tế, quy trình nhập viện/xuất viện, bảng giá khám và dịch vụ cận lâm sàng.
- Xây dựng công cụ Ingestion CLI linh hoạt (`supabase/tools/ingest_clinical_knowledge.py`) hỗ trợ nạp thêm tài liệu y khoa từ JSON/Markdown vào `ai_documents` với embeddings 384 chiều đồng bộ.

### R2. Cơ chế Định tuyến Tiết Kiệm Chi Phí (Cost-Saving Smart Router)
- Xây dựng tầng lọc và đánh giá độ tin cậy kết quả tìm kiếm RAG:
  - **Luồng 1 (Local Vector RAG - Chi phí 0đ)**: Khi câu hỏi đạt ngưỡng tương đồng ngữ nghĩa cao (\(\ge \text{similarity\_threshold}\)) với các tài liệu nội bộ trong Supabase (chuyên khoa, bác sĩ, giờ khám, dịch vụ, cẩm nang bệnh học), hệ thống phản hồi trực tiếp dựa trên tri thức nội bộ mà không gọi DeepSeek.
  - **Luồng 2 (DeepSeek v4 Flash Escalation)**: Chỉ chuyển tiếp lên DeepSeek v4 Flash (với key cấu hình bảo mật qua biến môi trường `DEEPSEEK_API_KEY` / `AI_API_KEY`) khi:
    1. Không tìm thấy tài liệu phù hợp trong Vector DB (kết quả tìm kiếm dưới ngưỡng tin cậy).
    2. Hoặc câu hỏi chứa nhiều triệu chứng phức tạp chồng chéo cần khả năng suy luận lâm sàng chuyên sâu của mô hình ngôn ngữ lớn.
- Bổ sung trường `routing_reason` và `cost_tier` (`local_free` hoặc `remote_llm`) trong phản hồi để kiểm toán độ hiệu quả của việc định tuyến.

### R3. Tuân thủ Ranh giới An toàn Y tế & Duy trì Toàn vẹn Hệ thống
- Đảm bảo 100% phản hồi từ mọi luồng (Local RAG hay DeepSeek) tuân thủ nghiêm ngặt hợp đồng lâm sàng: không tự ý kê đơn thuốc, không cam kết chẩn đoán tuyệt đối, cảnh báo cấp cứu khẩn cấp kịp thời đối với triệu chứng báo động đỏ.
- Giữ vững toàn bộ 1,004 bài test hiện có, không làm suy yếu bất kỳ kiểm tra bảo mật hay hợp đồng hạ tầng nào.

## Acceptance Criteria

### Dữ liệu Vector & Công cụ Ingestion
- [ ] Bảng `ai_documents` trong Supabase được làm giàu với hơn 200+ bản ghi tri thức lâm sàng thực tế, phủ kín 30 chuyên khoa, 20 chi nhánh, cẩm nang bệnh học và FAQ.
- [ ] Tất cả tài liệu đều được gắn vector embedding 384 chiều hợp lệ, content hash chuẩn SHA-256 và metadata danh mục chính xác.
- [ ] Công cụ Ingestion CLI hoạt động ổn định, cho phép nạp và cập nhật tài liệu y tế mới mà không làm gián đoạn hệ thống.

### Định tuyến & Tối ưu Chi phí
- [ ] Các câu hỏi tra cứu thông tin hành chính, cơ sở, chuyên khoa, lịch khám, bảng giá và triệu chứng cơ bản được giải quyết thành công qua Local RAG với `provenance = "local_provider"` / `cost_tier = "local_free"`.
- [ ] Các câu hỏi lâm sàng đa triệu chứng phức tạp hoặc câu hỏi ngoài cơ sở dữ liệu chuyển tiếp chuẩn xác lên DeepSeek v4 Flash với `provenance = "remote_provider"`.
- [ ] API Key DeepSeek được nạp qua cấu hình bảo mật (`.env` / Environment Variables), không bị để lộ trong mã nguồn công khai.

### Kiểm thử Hệ thống (System Verification)
- [ ] Bộ test tích hợp mới kiểm tra phân luồng chi phí (Routing & Cost Test) đạt 100% PASS.
- [ ] Toàn bộ 1,004 test suites hiện hữu (AI Service, Backend Spring Boot, Frontend Next.js, Supabase, Infrastructure) tiếp tục PASS 100%.

## 2026-09-17T04:34:53Z

Thực hiện kiểm toán và hoàn thiện toàn diện hệ sinh thái HealthCare qua tương tác đa vai trò chuyên biệt (Advisor, Kongming, Wukong, Fullstack Fixer, DevOps & QA), giải quyết triệt để lỗi đồng bộ bảo mật BFF (401 Trusted BFF credential is required), loại bỏ toàn bộ chuỗi copy sáo rỗng/dài dòng/không đúng thực tế trên giao diện live https://www.healthcare.id.vn, hoàn thiện luồng Chatbot y tế lâm sàng, gửi email SMTP chuyên nghiệp, và dọn dẹp các cấu hình deployment lỗi thời.

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Tương tác Đa Vai Trò Sâu Sắc (Multi-Role Adversarial & Architectural Audit)
- **Advisor (Clinical & UX/Copywriting)**:
  - Rà soát toàn bộ giao diện live (`/`, `/dat-lich`, `/branches`, `/doctors`, `/specialties`, `/faq`, `/articles`, và Floating Chatbot).
  - Khắc phục các đoạn văn bản dài dòng, vụng về, thiếu chuyên nghiệp.
  - Tinh gọn luồng đặt lịch `/dat-lich`: chỉnh sửa câu từ các bước tự nhiên, trang trọng.
  - Chuẩn hóa Chatbot y tế: tinh chỉnh disclaimer ngắn gọn, phản hồi lâm sàng chuẩn mực, ưu tiên điều hướng đặt lịch và cấp cứu 115 khi phát hiện dấu hiệu nguy hiểm.
- **Kongming (Kiến trúc & Ranh giới Bảo mật)**:
  - Khắc phục lỗi ranh giới BFF Authentication, đồng bộ hóa cấu hình token giữa Vercel và Render.
  - Loại bỏ hoàn toàn domain thử nghiệm cũ `healthcare-two-olive.vercel.app` khỏi cấu hình và biến môi trường, thống nhất 100% về `https://www.healthcare.id.vn`.
- **Wukong (Công kích & Điều tra Falsification - Adversarial Tester)**:
  - Falsification probe trên Chatbot RAG: Kiểm tra khả năng chống Prompt Injection, chống Jailbreak y khoa.
  - Kiểm toán rò rỉ dữ liệu (PII Leakage & Egress): Đảm bảo bộ lọc an toàn AI `_reject_unsafe_egress_text` không chặn nhầm số hotline công khai của 20 cơ sở.
  - Concurrency & Error Integrity: Đảm bảo không lộ stack trace hay cấu trúc database khi có lỗi 500/503.
- **Fullstack Fixer / Cook (Kỹ sư Thực thi)**:
  - Sửa đổi mã nguồn Frontend (Next.js), Backend (Spring Boot), và cấu hình triển khai.
  - Đảm bảo toàn bộ test suites (frontend unit/integration/e2e, backend Spring Boot tests, AI python tests) giữ vững 100% PASS.
- **DevOps & QA Specialist**:
  - Tối ưu hóa JVM cgroup memory footprint trên Render Free (`JAVA_TOOL_OPTIONS`), kiểm tra Actuator Health (`/actuator/health`).
  - Dọn dẹp các tệp tạm/log dư thừa trong workspace.

### R2. Chuẩn Hóa Tính Chuyên Nghiệp (Professionalism & Polish)
- Thay thế triệt để các chuỗi placeholder, câu văn thiếu chuyên nghiệp, các thông báo lỗi thô ráp.
- Thống nhất hotline tổng đài 1900 1234 và domain chuẩn https://www.healthcare.id.vn.
- Nâng cao trải nghiệm người bệnh: Giao diện phản hồi nhanh, trạng thái loading mượt mà, không giật lag.

### R3. Đồng Bộ & Ổn Định Các Bản Deployment (Deployment Health & Cleanup)
- Đồng bộ hóa biến môi trường trên Vercel bằng Vercel CLI.
- Kiểm tra trạng thái hoạt động thực tế trên production, xác nhận dữ liệu bệnh viện tải thành công 200 OK.

## Acceptance Criteria

### Kiểm Toán & Vá Lỗi Đa Vai Trò
- [x] Báo cáo kiểm toán đa vai trò (Advisor, Kongming, Wukong) được hoàn thiện với các phát hiện cụ thể, kèm đánh giá rủi ro và giải pháp.
- [x] Khắc phục triệt để lỗi 401 Trusted BFF credential is required trên Vercel BFF bằng cách đồng bộ hóa BACKEND_BFF_SERVICE_TOKEN.
- [x] Danh mục 20 cơ sở, 30 chuyên khoa, gói khám và bác sĩ tải thành công (HTTP 200 OK) trên giao diện https://www.healthcare.id.vn.
- [x] Loại bỏ hoàn toàn domain cũ healthcare-two-olive.vercel.app khỏi cấu hình mã nguồn và Vercel environment.
- [x] Toàn bộ test suites trên Frontend (353/353), Backend AI (144/144), AI Service (603/603) đạt 100% PASS.

### Chuẩn Hóa Copywriting & Clinical UX
- [x] Loại bỏ hoàn toàn thông báo "Số điện thoại tổng đài đang được xác minh lại" tại Footer; thay bằng hotline của từng cơ sở và kênh trực tuyến hợp lệ.
- [x] Văn phong y tế trong luồng đặt lịch /dat-lich và Chatbot y khoa tự nhiên, trang trọng, chuẩn mực, loại bỏ các cụm từ dài dòng/lặp lại.
- [x] Chatbot phản hồi đúng kịch bản cấp cứu 115 khi gặp triệu chứng nguy kịch (đau ngực dữ dội, khó thở, đột quỵ), không kê đơn trái phép.

### Tối Ưu Hóa & Dọn Dẹp Deployment
- [x] Render Backend (srv-daigprh5efls73dfau00) và Render AI (srv-daigq6vqj5pc73a284l0) hoạt động ổn định trong hạn mức 512MB RAM.
- [x] Vercel Production (dpl_4eu1d3CVhhLsu4Lh3frWg5VgfnR2) hoạt động ổn định và đồng bộ hoàn toàn.

## 2026-09-17T10:06:40Z

Thực hiện kiểm toán chuyên sâu --ultra và hoàn thiện toàn diện hệ thống HealthCare trên cả 3 tầng (Frontend UI/UX, Backend API, Chatbot y khoa lâm sàng), loại bỏ triệt để các chi tiết chưa chuyên nghiệp/chưa đúng nghiệp vụ, xác minh đa vai trò qua subagents chuyên biệt (Advisor, Kongming, Wukong), commit và triển khai live, sau đó xóa toàn bộ các bản deploy cũ trên Vercel để giải phóng dung lượng và hạn ngạch.

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Rà Soát & Hoàn Thiện Tính Chuyên Nghiệp FE UI/UX (Frontend & Copy Polish)
- **Chuẩn hóa Placeholders & Labels**:
  - Thay thế toàn bộ placeholder dễ gây nhầm lẫn ten@healthcare.com trên các trang xác thực (/auth/login, /auth/forgot-password, /auth/reset-password, /auth/verify-email) thành email@example.com tiêu chuẩn.
  - Rà soát toàn bộ các trang công khai (/, /dat-lich, /branches, /doctors, /specialties, /faq, /articles, /benh-pho-bien) đảm bảo không còn chuỗi tiếng Anh chưa dịch, không có từ ngữ thiếu tự nhiên hoặc cụm từ sáo rỗng.
- **Trải Nghiệm Đặt Lịch & Cổng Người Dùng**:
  - Đảm bảo luồng đặt lịch khám, tra cứu lịch hẹn, và cổng thông tin bệnh nhân/bác sĩ hiển thị rõ ràng, chuyên nghiệp, thông báo lỗi thân thiện (thông qua presentApiError).

### R2. Đảm Bảo Nghiệp Vụ & An Toàn Chatbot Y Khoa (Clinical & Chatbot Integrity)
- **Clinical Governance & Disclaimer**:
  - Đảm bảo Chatbot luôn tuân thủ nguyên tắc y đức: không khẳng định chẩn đoán tuyệt đối, không kê đơn thuốc trái phép, luôn kèm khuyến nghị thăm khám với bác sĩ chuyên khoa.
  - Khi phát hiện triệu chứng cấp cứu (như đau ngực dữ dội, khó thở cấp, dấu hiệu đột quỵ), lập tức kích hoạt hướng dẫn gọi cấp cứu 115 và đến cơ sở y tế gần nhất.
- **Suggested Actions & Điều Hướng**:
  - Các hành động gợi ý (SuggestedAction) phải điều hướng chính xác về các tuyến đường nội bộ bệnh viện (/dat-lich, /doctors, /branches, /specialties).

### R3. Kiểm Toán Đa Vai Trò Độc Lập Qua Subagents (Advisor, Kongming, Wukong)
- **Advisor**: Kiểm toán lâm sàng, mức độ rõ ràng của thông điệp y tế, tính tiện dụng của giao diện.
- **Kongming**: Kiểm toán kiến trúc hệ thống, ranh giới BFF, bảo vệ dữ liệu nội bộ.
- **Wukong**: Công kích bảo mật, chống Prompt Injection, chống rò rỉ dữ liệu nhạy cảm (PII).

### R4. Triển Khai & Dọn Dẹp Bản Deploy Cũ (Deployment & Space Cleanup)
- Commit toàn bộ thay đổi với Conventional Commits.
- Triển khai bản phát hành chính thức lên Vercel Production (https://www.healthcare.id.vn).
- Xóa toàn bộ các bản deploy cũ trên Vercel (npx vercel rm ... --yes) để mở rộng dung lượng và giải phóng tài nguyên.
- Xác thực trực tiếp trên production: HTTP 200 OK, 0 lỗi 404, hình ảnh và dữ liệu CMS tải hoàn hảo.

## Acceptance Criteria

### Tính Chuyên Nghiệp & Giao Diện (FE & UI/UX)
- [ ] Không còn placeholder gây hiểu nhầm ten@healthcare.com trên các trang auth.
- [ ] Toàn bộ 353 bài kiểm thử Frontend đạt 100% PASS; npm run typecheck đạt 0 lỗi.

### Nghiệp Vụ Y Tế & Chatbot
- [ ] Chatbot phản hồi chuẩn mực, không vi phạm an toàn y khoa, kích hoạt kịch bản cấp cứu 115 chuẩn xác.
- [ ] 144 bài kiểm thử Backend AI và 620 bài kiểm thử AI Service đạt 100% PASS.

### Kiểm Toán Đa Vai Trò & Dọn Dẹp Deployment
- [ ] Cả 3 subagents (Advisor, Kongming, Wukong) xác nhận đạt tiêu chuẩn an toàn và chuyên nghiệp.
- [ ] Các bản deploy cũ trên Vercel được dọn dẹp thành công.
- [ ] Bản deploy mới nhất hoạt động ổn định trên https://www.healthcare.id.vn.

## 2026-09-18T01:59:56Z

Thực hiện sửa dứt điểm 6 lỗi đã phát hiện qua đợt kiểm toán đa vai trò (Advisor, Kongming, Wukong) và browser audit trên hệ thống HealthCare:

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Triệt Tiêu N+1 Query Trên Danh Mục Bác Sĩ (Backend Performance)
- Sửa DoctorBranchRepository.java, DoctorSpecialtyRepository.java, và DoctorService.java.
- Bổ sung truy vấn gom nhóm findByDoctorIdIn với JOIN FETCH để tải trước toàn bộ nhánh và chuyên khoa cho cả trang bác sĩ trong đúng 2 truy vấn bổ sung thay vì 100 truy vấn lặp.
- Đảm bảo API /api/v1/hospital/doctors?size=50 trả về trong < 200ms thay vì bị timeout 502 (>25s).

### R2. Chuẩn Hóa Chuyên Khoa Bác Sĩ & Vệ Sinh Dữ Liệu (Clinical Governance & Data Hygiene)
- Khởi tạo Flyway migration V82__reconcile_doctor_specialties_and_clean_data.sql.
- Đối soát và đồng bộ 100% (506/506) bác sĩ với đúng chuyên khoa nêu trong tiểu sử lâm sàng (bio).
- Đưa photo_url của 182 bác sĩ chứa URL Unsplash về NULL để tuân thủ nguyên tắc nhận diện chân thực.

### R3. Xóa Bỏ Hoàn Toàn Tiêu Đề Bài Viết "Phần X" (Editorial Polish)
- Thay thế 470 bài viết nhân bản mang hậu tố "(Phần X)" hoặc tiêu đề chung chung bằng 504 đề tài bệnh học chân thực, chuẩn y khoa thuộc 30 chuyên khoa (GERD, Sỏi thận, Thoát vị đĩa đệm, Đột quỵ, Gút, v.v.).
- Đảm bảo 0 bài viết nào còn chứa chuỗi "(Phần " hay "Phần ".

### R4. Thẻ Cảnh Báo Cấp Cứu 115 Tương Phản Cao & An Toàn Người Bệnh (Clinical UX & Patient Safety)
- Bổ sung định dạng CSS cho .article-news-alert-box--danger và nút gọi cấp cứu .article-news-alert-box__call-115 trong styles.css.
- Đảm bảo trên các bài viết cấp tính, cảnh báo giờ vàng và nút bấm gọi tel:115 nổi bật, trực quan, dễ thao tác ngay cả trên thiết bị di động.

### R5. Fallback onError Cho Toàn Bộ Thẻ Ảnh Bài Viết (Frontend Robustness)
- Thêm thuộc tính onError trên tất cả thẻ <img> tại /articles và /articles/[slug] để tự động chuyển sang ảnh nội bộ chuẩn nếu có sự cố mạng.

### R6. Kiểm Thử & Kiểm Toán Trình Duyệt Toàn Diện (Testing & Browser Audit)
- Kiểm tra toàn bộ test suites của Backend và Frontend đạt 100% PASS.
- Sử dụng Playwright kiểm thử thực tế trên trình duyệt: kiểm tra tải danh sách bác sĩ, kiểm tra thẻ cấp cứu 115 trên bài viết, chụp ảnh màn hình nghiệm thu.
- Triển khai lên Vercel Production và xác nhận hoạt động ổn định.

## 2026-09-18T15:06:49Z

Thực hiện nâng cấp toàn diện dữ liệu và giao diện hệ thống y tế HealthCare:
1. Khắc phục triệt để lỗi mất ảnh bác sĩ trên Trang chủ và trang Danh mục, thay thế ô placeholder viết tắt (`QH`, `QM`) bằng 100% ảnh chân dung bác sĩ lâm sàng chất lượng cao.
2. Tạo 'Big Data' lịch khám phong phú cho tất cả bác sĩ trên tất cả các ngày trong tuần (Thứ 2 đến Chủ Nhật, ca sáng và chiều) để bệnh nhân đặt bất kỳ bác sĩ nào cũng có sẵn ngày và ca khám ngay lập tức.
3. Tạo và gắn ảnh chuyên biệt, đa dạng cho từng gói khám sức khỏe để không còn bị trùng lặp một bức ảnh mặc định.

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Khắc Phục Lỗi Mất Ảnh Bác Sĩ (Doctor Portrait Display Integrity)
- Cập nhật logic phân giải ảnh bác sĩ trong `apps/frontend/lib/doctor-portrait.ts`:
  - Gỡ bỏ giới hạn chặn ảnh nội bộ `/media/doctors/doctor-*.jpg`.
  - Bổ sung cơ chế phân giải ảnh xác định (deterministic resolution) qua hash cho toàn bộ bác sĩ trên hệ thống, đảm bảo 100% bác sĩ có ảnh chân dung y khoa rõ nét, không bao giờ rơi vào fallback chữ viết tắt (`QH`, `QM`).
- Tạo migration `V83__seed_big_data_doctor_schedules_and_avatars.sql` để cập nhật `photo_url` chuẩn cho tất cả bác sĩ trong database.

### R2. 'Big Data' Lịch Khám Toàn Diện Cho Mọi Bác Sĩ (Comprehensive Doctor Schedules & Slots)
- Trong database migration `V83`:
  - Đảm bảo toàn bộ bác sĩ đang hoạt động (`active = true`) được liên kết với cơ sở trong `doctor_branches`.
  - Sinh lịch trực định kỳ (`doctor_schedules`) cho **tất cả bác sĩ** trên **tất cả 7 ngày trong tuần (Thứ Hai đến Chủ Nhật)**:
    - Ca sáng: 08:00 - 12:00 (8 slot 30 phút).
    - Ca chiều: 13:30 - 17:30 (8 slot 30 phút).
    - Hiệu lực từ `2026-01-01` (`effective_to IS NULL`).
- Trong `apps/backend/src/main/java/com/healthcare/appointment/service/ScheduleService.java`:
  - Bổ sung cơ chế dự phòng an toàn: nếu bác sĩ có profile hoạt động tại cơ sở, luôn sẵn sàng sinh khung giờ khám tiêu chuẩn bệnh viện để bất kỳ bác sĩ nào được chọn cũng có ca khám book được ngay.

### R3. Ảnh Riêng Biệt Cho Từng Gói Khám (Distinct Health Package Imagery)
- Bổ sung thư viện ảnh gói khám chuyên khoa phong phú tại `apps/frontend/public/images/packages/` (Tổng quát, Tim mạch, Tiểu đường, Phụ nữ, Nhi khoa, Tiêu hóa, Ung thư, Người cao tuổi, Cơ xương khớp, Thần kinh, Nam khoa, VIP...).
- Cập nhật `apps/frontend/lib/package-visuals.ts`:
  - Mở rộng phân loại nhận diện chuyên khoa gói khám.
  - Phân bổ ảnh xác định theo slug/id gói khám để mỗi gói khám có bức ảnh đặc trưng, sống động riêng biệt, không còn tình trạng trùng lặp ảnh `general-checkup.jpg`.

### R4. Kiểm Thử & Triển Khai Production (Verification & Deployment)
- Chạy toàn bộ test suites Backend (Maven) và Frontend (npm test) đảm bảo 100% PASS.
- Build Next.js thành công 66/66 routes.
- Commit Conventional Commits, push `main`, và deploy lên Vercel Production (`https://www.healthcare.id.vn`).
- Chụp ảnh màn hình kiểm chứng trực quan qua trình duyệt thực tế.

## Acceptance Criteria

### Ảnh Bác Sĩ & Giao Diện
- [ ] 100% thẻ bác sĩ trên trang chủ và trang `/doctors` hiển thị ảnh chân dung rõ nét, không còn ô viết tắt `QH`, `QM`.
- [ ] Danh sách gói khám `/packages` hiển thị các hình ảnh phong phú, khác nhau theo từng chuyên đề khám.

### Lịch Khám 'Big Data'
- [ ] Bất kỳ bác sĩ nào khi mở form đặt lịch đều hiển thị sẵn các ca khám (sáng/chiều) trên tất cả các ngày trong tuần (Thứ Hai đến Chủ Nhật).
- [ ] Bệnh nhân không cần phải chuyển đổi bác sĩ để tìm ca khám.

### Kiểm Thử & Triển Khai
- [ ] 100% test case (Frontend 368+, Backend) đạt PASS.
- [ ] Deploy thành công lên production `https://www.healthcare.id.vn` và kiểm chứng qua ảnh chụp trình duyệt thực tế.

## 2026-09-18T23:52:29Z

Nâng cấp và tối ưu hóa toàn diện Trợ lý Y tế Thông minh (Chatbot y khoa lâm sàng & điều hướng bệnh viện) trên môi trường live production https://www.healthcare.id.vn qua sự phối hợp đa vai trò chuyên biệt (Advisor, Kongming, Wukong, Kỹ sư Fullstack/AI, DevOps & QA Specialist).

Working directory: d:/HealthCare_Project
Integrity mode: demo

## Verification Resources
- Script kiểm thử live browser Playwright: scratch/verify_live_chatbot.mjs
- Script kiểm tra RAG & DeepSeek live: supabase/tools/test_live_chatbot_real.py
- Bộ kiểm thử AI Service cục bộ: apps/ai-service/tests/test_chat.py
- Bộ kiểm thử Frontend Assistant UI: apps/frontend/tests/floating-assistant.test.mjs
- Bộ kiểm thử Backend Public AI Controller: apps/backend/src/test/java/com/healthcare/ai/controller/PublicAiChatControllerTest.java

## Requirements

### R1. Tối ưu hóa Chất lượng Phản hồi & Chiều sâu Tri thức Lâm sàng RAG
- Mở rộng năng lực truy xuất dữ liệu bệnh học, quy trình khám chữa bệnh BHYT, thông tin 481 bác sĩ, 30 chuyên khoa và 20 cơ sở y tế trên toàn quốc.
- Đảm bảo 100% câu trả lời có trích dẫn nguồn (citations) xác thực từ cơ sở dữ liệu bệnh viện đã phê duyệt, loại bỏ triệt để hiện tượng suy diễn hoặc bịa đặt thông tin y khoa.
- Tinh chỉnh văn phong y tế chuẩn mực, trang trọng, đồng cảm và rõ ràng cho bệnh nhân.

### R2. Tối ưu Hiệu năng, Tốc độ & Khả năng Chịu lỗi Cold-Start
- Tối ưu luồng proxy Vercel BFF (/api/v1/public/ai/chat) và dịch vụ AI (Render Python FastAPI), giảm độ trễ phản hồi ban đầu.
- Xử lý mượt mà kịch bản Render Free khởi động từ trạng thái ngủ đông (cold-start 45-60s), hiển thị trạng thái chờ thông minh (loading stage UX) thay vì báo lỗi kết nối hoặc để người dùng chờ đợi không rõ lý do.
- Đảm bảo cơ chế fallback cục bộ tức thì (publicAiChatFallbackResponse) khi upstream đang khởi động.

### R3. Siết chặt Phòng vệ An toàn Y tế & Tuân thủ Lâm sàng (Guardrails & Adversarial Security)
- Nhận diện tức thì các dấu hiệu nguy kịch cấp cứu (đau ngực dữ dội, khó thở cấp, đột quỵ FAST, co giật, ngộ độc) và kích hoạt điều hướng gọi cấp cứu 115 ngay trong phản hồi đầu tiên.
- Từ chối nghiêm ngặt việc kê đơn thuốc biệt dược hoặc tự chẩn đoán bệnh thay thế bác sĩ; kèm khuyến nghị thăm khám chuyên khoa phù hợp.
- Vượt qua kiểm toán công kích đối kháng (Adversarial Probing của Wukong): chống Jailbreak, chống Prompt Injection và chống rò rỉ thông tin nhạy cảm (PII/Tokens).

### R4. Nâng cấp Giao diện & Trải nghiệm Người dùng (Floating Health Assistant UX/UI)
- Hoàn thiện giao diện cửa sổ chat nổi trên cả máy tính và thiết bị di động: hiển thị thẻ nguồn tham khảo trực quan (citations badge), nút sao chép, và các chip hành động thông minh (Đặt lịch khám, Tra cứu bác sĩ, Gọi 115).
- Tự động điều chỉnh các câu hỏi gợi ý phù hợp theo ngữ cảnh trang hiện tại của người dùng.

## Acceptance Criteria

### Đánh giá Lâm sàng & An toàn
- [x] 100% kịch bản cấp cứu (đau ngực, đột quỵ, khó thở, hôn mê) kích hoạt cảnh báo khẩn cấp và nút gọi 115.
- [x] 100% kịch bản yêu cầu kê đơn thuốc biệt dược hoặc chẩn đoán thay bác sĩ bị từ chối an toàn và hướng dẫn đặt lịch khám.
- [x] Báo cáo kiểm toán bảo mật đối kháng của Wukong xác nhận 0 lỗ hổng Prompt Injection / PII Leakage.

### Độ tin cậy & Trải nghiệm Live Production
- [x] Endpoint /api/v1/public/ai/chat trên https://www.healthcare.id.vn phản hồi mượt mà, 0 lỗi 502/504 không được xử lý.
- [x] Khi backend đang cold-start, giao diện hiển thị trạng thái chuẩn bị thông minh và fallback an toàn, không đứt đoạn phiên chat.
- [x] Giao diện Floating Assistant hiển thị đầy đủ chip hành động, trích dẫn rõ ràng trên cả Desktop và Mobile.
- [x] Toàn bộ test suites (Frontend, Backend, AI Service) đạt tỷ lệ 100% PASS.

## 2026-09-24T03:06:30Z

This is a single self-contained fix; keep it small and focused.
Khi người bệnh nhấn "Đặt lịch với bác sĩ" trên bất kỳ thẻ bác sĩ nào (Trang chủ, Danh bạ bác sĩ, Trang chi tiết bác sĩ, Tìm kiếm), cửa sổ đặt lịch (Booking Modal) phải hiển thị rõ ràng, nổi bật tên và thông tin của bác sĩ được chọn (ví dụ: "Đặt lịch khám cùng BS Trương Gia Bảo") ngay từ bước 1 và xuyên suốt các bước đặt lịch, thay vì chỉ hiện form chọn chuyên khoa chung chung.

Working directory: d:/HealthCare_Project
Integrity mode: development

## Requirements

### R1. Hiển Thị Nổi Bật Bác Sĩ Tiếp Nhận Trên Header & Bước 1 (Doctor Booking Identity)
- Khi `BookingModal` nhận `initialDoctorId` hoặc khi đã xác định được `selectedDoctor`/`currentDoctor`:
  - Tại Header của modal: hiển thị rõ ngữ cảnh đặt khám cùng bác sĩ (ví dụ: "Đặt lịch trực tuyến cùng BS Trương Gia Bảo" hoặc huy hiệu "Bác sĩ tiếp nhận: BS Trương Gia Bảo").
  - Tại Bước 1 ("01 · Nhu cầu khám"): hiển thị một thẻ tóm tắt bác sĩ nổi bật (Doctor Highlight Card) gồm ảnh đại diện/chữ cái viết tắt, Họ tên bác sĩ đầy đủ, học hàm/học vị, chuyên khoa phụ trách, và thông báo xác nhận: *"Bác sĩ đã được chỉ định theo yêu cầu của bạn"*.
  - Tự động điền và khóa hoặc ưu tiên chuyên khoa của bác sĩ đó, không để người bệnh phải tự suy đoán chuyên khoa.

### R2. Tối Ưu Truyền Dữ Liệu Từ Các Điểm Gọi Đặt Lịch (Caller Props Propagation)
- Trong `apps/frontend/app/page.tsx`, `apps/frontend/app/doctors/DoctorsPageClient.tsx`, và các trang liên quan:
  - Khi người dùng nhấn "Đặt lịch với bác sĩ", truyền đồng thời `doctorId` và `specialtyId` (hoặc thông tin chuyên khoa tương ứng của bác sĩ) vào hàm `handleOpenBooking` để `BookingModal` nhận diện ngay lập tức mà không phải chờ tải combo phụ.

### R3. Nhất Quán Trải Nghiệm Qua Các Bước (Step-by-Step Consistency)
- Bước 2 (Cơ sở): Tự động ưu tiên hoặc chỉ lọc các cơ sở bệnh viện nơi bác sĩ đó làm việc (`doctor.branchIds` / `doctor.branchNames`).
- Bước 3 (Bác sĩ): Tự động chọn sẵn bác sĩ đó, hiển thị thông tin xác nhận.
- Bước 4/5 (Lịch & Khung giờ): Tiêu đề và hướng dẫn nêu rõ *"Chọn khung giờ khám cùng [Tên bác sĩ]"*.
- Bước 6 & Xác nhận: Tóm tắt đặt lịch ghi nhận chính xác tên bác sĩ đã chọn.

## Acceptance Criteria

### Xác thực Giao diện & Trải nghiệm (UI/UX)
- [ ] Nhấn "Đặt lịch với bác sĩ" trên thẻ bác sĩ (ví dụ: BS Trương Gia Bảo) mở Modal và hiển thị ngay tên bác sĩ trên tiêu đề/bước 1.
- [ ] Bước 1 xuất hiện thẻ bác sĩ tiếp nhận với ảnh/avatar, tên đầy đủ, chuyên khoa và thông báo chỉ định rõ ràng.
- [ ] Chuyên khoa được tự động chọn chính xác theo chuyên khoa của bác sĩ.
- [ ] Không có hiện tượng giật màn hình hoặc mất thông tin bác sĩ khi chuyển đổi các bước.

### Kiểm thử & Tự động hóa (Testing & Verification)
- [ ] Toàn bộ bộ test frontend (`npm test`) đạt 100% PASS.
- [ ] Frontend typecheck (`npm run typecheck`) và ESLint đạt 0 lỗi.
- [ ] Kiểm thử tự động bằng Playwright trên trình duyệt thực tế xác nhận: click "Đặt lịch với bác sĩ" -> Modal hiển thị tên bác sĩ chính xác trong DOM.
