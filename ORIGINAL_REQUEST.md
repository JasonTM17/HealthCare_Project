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
