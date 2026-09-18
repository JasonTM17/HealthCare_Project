# Báo cáo Đánh giá Chuyên môn (Advisor Report): Big Data Production HealthCare

**Đơn vị thực hiện:** Advisor (AgentKit Workflow)  
**Vai trò:** Clinical, Product, and Editorial Quality Reviewer  
**Đối tượng kiểm toán:** Dữ liệu lớn lâm sàng (Big Data) mới làm giàu trên môi trường Production (`https://www.healthcare.id.vn`):
- **504 bài viết y khoa** (471 bài kích hoạt trên catalog, 33 bài dự phòng/nội bộ)
- **506 hồ sơ bác sĩ** (481 bác sĩ active, 25 bác sĩ inactive thử nghiệm phân trang)
- **200 dịch vụ y tế** (192 dịch vụ active)
- **100 gói khám sức khỏe** (95 gói active)
- **150 câu hỏi thường gặp (FAQs)** (145 câu active)  
**Thời điểm thực hiện:** 18/09/2026  
**Phán quyết chung:** **ĐẠT CÓ ĐIỀU KIỆN (PASS WITH CRITICAL REMEDIATIONS)**

---

## Tóm tắt Điều hành (Executive Summary)

Dữ liệu lâm sàng được mở rộng quy mô lớn (Big Data) đã đưa nền tảng HealthCare Production từ một hệ thống demo quy mô nhỏ trở thành một cổng thông tin y tế chuyên sâu có dung lượng dữ liệu tương đương các bệnh viện đa khoa hạng 1.

| Chỉ tiêu Kiểm toán | Hiện trạng Định lượng | Tỷ lệ Đạt Chuẩn | Đánh giá Chuyên môn |
| :--- | :--- | :--- | :--- |
| **Ảnh bìa bài viết (Cover Image)** | 471 / 471 bài viết có ảnh bìa hợp lệ | **100%** | Ảnh phân bổ theo chuyên khoa, độ phân giải cao, chuẩn thẩm mỹ y tế. |
| **Cấu trúc bài viết (Sections & Sapo)** | 467 / 471 bài có cấu trúc sections + sapo | **99.15%** | Đầy đủ Sapo, Điểm tin chính, Dấu hiệu cảnh báo và Lời khuyên phòng ngừa. |
| **Giao thức Cấp cứu 115 & Giờ vàng** | 355 bài viết chứa cảnh báo cấp cứu 115 | **75.4%** | Nhận diện chuẩn quy tắc FAST (đột quỵ) và đau ngực > 15 phút (mạch vành). |
| **Tác giả Bác sĩ Lâm sàng** | 10 chuyên gia thực thụ (TS.BS, ThS.BS, CKI/CKII) | **100%** | Bác sĩ thật, đầy đủ học hàm/học vị, trường đào tạo danh tiếng. |
| **Hồ sơ Bác sĩ (Doctor Profiles)** | 506 bác sĩ có học vị, tiểu sử, số năm kinh nghiệm | **100%** | Có học hàm chuẩn (TS.BS, ThS.BS, BS.CKII, BS.CKI), số năm kinh nghiệm thực tế. |
| **Định giá Gói khám (Packages)** | 95 / 95 gói có giá, checklist, chuẩn bị | **100%** | Phổ giá thực tế 1.450.000đ – 10.700.000đ (Trung vị: 3.650.000đ). |
| **Hiệu năng Tải dữ liệu Bác sĩ** | Query N+1 tại `/api/v1/hospital/doctors` | **BÁO ĐỘNG** | Kích thước trang 50 gây HTTP 502 (Gateway Timeout > 25s) do 100 truy vấn con. |
| **Tính chân thực & AI Slop** | Tồn tại "Hội chứng Phần X" (Phần 4, Phần 11...) | **CẦN SỬA** | Tiêu đề và nội dung bài viết bị nhân bản thành nhiều phần giống nhau. |

---

## 1. Phân tích Tính Chân thực Lâm sàng (Clinical Authenticity)
*Tuân thủ Hướng dẫn Chẩn đoán & Điều trị của Bộ Y tế Việt Nam và Tổ chức Y tế Thế giới (WHO)*

### 1.1 Điểm sáng Lâm sàng (Clinical Strengths)
* **Thuật ngữ Y khoa Chuẩn mực Bộ Y tế:**
  - Các bài viết đinh lề (pillar articles) thể hiện độ chính xác cao về mặt bệnh học: thuật ngữ *"Đột quỵ nhồi máu não"*, *"Xuất huyết não"*, *"Thuốc tiêu sợi huyết đường tĩnh mạch (rtPA)"*, *"Lấy huyết khối bằng dụng cụ cơ học"*, *"Vi khuẩn Helicobacter pylori (H. pylori)"*, *"Test hơi thở C13/C14 (Urea Breath Test)"*, *"Phác đồ 4 thuốc có Bismuth"*, *"Chỉ số HbA1c >= 6.5%"*.
  - Dẫn nguồn tài liệu tham khảo chính thống từ Bộ Y tế Việt Nam, Hội Đột quỵ Việt Nam, Hội Thấp khớp học Việt Nam, Hội Tiêu hóa Việt Nam, phối hợp với các tổ chức quốc tế: *AHA/ASA 2026*, *Maastricht VI/Florence Consensus*, *ADA Standards of Care in Diabetes 2026*, *NASS Clinical Guidelines*.
* **Xóa bỏ các Thói quen Nguy hại theo Văn hóa Dân gian:**
  - Các bài viết chuyên khoa thần kinh và cấp cứu đưa ra cảnh báo dứt khoát: **Tuyệt đối không cạo gió, không chích lể mười đầu ngón tay, không vắt chanh vào miệng và không tự ý cho uống An Cung Ngưu Hoàng Hoàn** khi nghi ngờ đột quỵ. Đây là giá trị truyền thông giáo dục sức khỏe (Health Education) xuất sắc, giúp ngăn chặn nguy cơ tắc đường thở và tử vong trước viện.
* **Học vị và Danh xưng Bác sĩ Chuẩn Quy chế:**
  - 100% hồ sơ sử dụng tiền tố danh xưng y khoa chính quy tại Việt Nam: `TS.BS` (Tiến sĩ Bác sĩ), `ThS.BS` (Thạc sĩ Bác sĩ), `BS.CKII` (Bác sĩ Chuyên khoa 2), `BS.CKI` (Bác sĩ Chuyên khoa 1).
  - Đơn vị đào tạo được định danh uy tín: *Đại học Y Dược TP.HCM*, *Đại học Y Hà Nội*, *Đại học Y khoa Phạm Ngọc Thạch*, *Học viện Quân Y*.

### 1.2 Lỗi Lâm sàng & Xung đột Dữ liệu Cần Khắc phục (Critical Clinical Flaws)
> [!CAUTION]
> **Xung đột Nghiêm trọng giữa Chuyên khoa trong Tiểu sử và Chuyên khoa Phân bổ Hệ thống:**
> - **Triệu chứng dữ liệu:** Khảo sát ngẫu nhiên phát hiện nhiều bác sĩ có tiểu sử lâm sàng một đằng nhưng lại được liên kết vào chuyên khoa hệ thống một nẻo:
>   - Bác sĩ **TS.BS Lê Quốc Hà** (`bs-47`): Tiểu sử ghi *"hơn 28 năm kinh nghiệm chuyên sâu trong lĩnh vực Ngoại thần kinh"*, nhưng hệ thống lại gắn vào chuyên khoa `Nội mạch máu` và `Thính học`.
>   - Bác sĩ **BS.CKII Võ Quốc Yến** (`bs-29`): Tiểu sử ghi *"hơn 26 năm kinh nghiệm chuyên sâu trong lĩnh vực Thính học"*, nhưng hệ thống lại gắn vào chuyên khoa `Mắt` và `Huyết học`.
>   - Bác sĩ **TS.BS Võ Văn Huy** (`bs-44`): Tiểu sử ghi *"hơn 23 năm kinh nghiệm chuyên sâu trong lĩnh vực Dinh dưỡng"*, nhưng hệ thống lại gắn vào chuyên khoa `Thần kinh`.
> - **Nguyên nhân cốt lõi:** Quá trình seed dữ liệu ngẫu nhiên (`ORDER BY md5(...)`) đã tạo liên kết bác sĩ - chuyên khoa mà không đối chiếu logic với chuỗi văn bản tiểu sử.
> - **Rủi ro an toàn người bệnh:** Bệnh nhân bị bệnh lý tai mũi họng - thính học khi đặt lịch lại được đưa vào phòng khám Mắt, vi phạm nghiêm trọng quy định phân công khám chữa bệnh theo phạm vi chứng chỉ hành nghề của Bộ Y tế.

---

## 2. An toàn Người bệnh & Giao thức Cấp cứu 115 (Patient Safety & Emergency Protocols)

### 2.1 Đánh giá Tuân thủ Quy tắc FAST trong Cấp cứu Đột quỵ
* **Nội dung hướng dẫn FAST:** Đạt điểm tối đa về tính rõ ràng:
  - **F (Face - Mặt):** Liệt mặt, nụ cười méo, nhân trung lệch sang một bên.
  - **A (Arm - Tay):** Yếu liệt tay chân một bên, không nâng đều hai tay.
  - **S (Speech - Lời nói):** Nói khó, nói ngọng, biến đổi giọng nói.
  - **T (Time - Thời gian):** Kích hoạt cấp cứu 115 ngay lập tức.
* **Thời gian vàng (Golden Window):** Nhấn mạnh rõ ràng mốc 4.5 giờ đối với tiêu sợi huyết tĩnh mạch (rtPA) và mở rộng 6 – 24 giờ đối với can thiệp lấy huyết khối cơ học qua catheter.

### 2.2 Đánh giá Quy tắc Đau thắt ngực Mạch vành Cấp (> 15 Phút)
* **Tiêu chuẩn đau thắt ngực:** 14 bài viết tim mạch định nghĩa chuẩn cơn đau thắt ngực điển hình: Đau sau xương ức như bị bóp nghẹt, đè nặng, lan lên vai trái, cánh tay trái hoặc hàm dưới, kéo dài trên 15 - 20 phút không đỡ khi nghỉ ngơi hoặc ngậm Nitroglycerin.
* **Chỉ định hành động:** Cảnh báo nguy cơ nhồi máu cơ tim cấp (Acute Myocardial Infarction) và hướng dẫn người nhà gọi xe cấp cứu 115 có trang bị sốc điện/oxy thay vì tự vận chuyển bằng xe máy.

### 2.3 Điểm Hạn chế về Trải nghiệm An toàn trên Giao diện Bài viết (UX Safety Gap)
> [!WARNING]
> **Thiếu Nút Kích hoạt Cấp cứu 115 Trực quan trên Trang Chi tiết Bài viết:**
> Trong khi Trợ lý AI (`FloatingHealthAssistant`) đã có banner đỏ chặn khẩn cấp `tel:115` khi người dùng nhập triệu chứng, thì trên trang bài viết y khoa (`/articles/[slug]`), mục `Dấu hiệu cảnh báo nguy hiểm` chỉ hiển thị dưới dạng danh sách gạch đầu dòng thông thường. Nếu người nhà bệnh nhân đang tra cứu trong cơn nguy kịch, họ có thể bỏ lỡ việc gọi cấp cứu khẩn cấp.
> **Khuyến nghị:** Bổ sung một Callout Card đỏ nổi bật với số Hotline Cấp cứu 115 nhấp được ngay trên đầu phần Dấu hiệu cảnh báo của các bài viết thuộc nhóm Tim mạch, Thần kinh, Hô hấp và Nhi khoa.

---

## 3. Tính Nhất quán Thị giác & Văn phong Biên tập (Visual & Copywriting Consistency)
*Rà soát Placeholder, Tính chân thực Hình ảnh và Dấu vết "AI Slop"*

### 3.1 Hình ảnh Chân dung Bác sĩ và Tránh Ảnh Stock Giả mạo
* **Cơ chế Hàng rào Phòng vệ (Defensive Fence):**
  - Đội ngũ kỹ thuật đã triển khai thành công logic tại `lib/doctor-portrait.ts`: Chặn hoàn toàn việc dùng hàm băm ID để gán ảnh ngẫu nhiên từ Unsplash cho các bác sĩ có tên tuổi người Việt.
  - Các bác sĩ không có ảnh chân dung chụp thật trong áo blouse trắng được hiển thị chữ cái đầu tên trang trọng (Initials Avatar), đảm bảo tính liêm chính và trung thực của một cơ sở khám chữa bệnh.
* **Tồn đọng Dữ liệu:**
  - Trong cơ sở dữ liệu backend, cột `photo_url` của bảng `doctors` vẫn còn lưu các URL Unsplash (ví dụ: `https://images.unsplash.com/photo-1651008376811-b90baee60c1f`). Dù frontend đã chặn hiển thị, backend seed data cần được dọn dẹp triệt để (chuyển về NULL) để không gây rò rỉ khi bên thứ ba tích hợp API.

### 3.2 Nhận diện Dấu vết Nhân bản Nội dung ("AI Slop / Syndrome Phần X")
> [!IMPORTANT]
> **Hiện tượng Lạm dụng Hậu tố "Phần X" trong Danh mục Bài viết:**
> - Khảo sát 471 bài viết phát hiện có tới **hơn 200 bài viết** có tiêu đề bị gắn hậu tố nhân bản:
>   - *"Trào ngược dạ dày thực quản (GERD): Cách phân biệt với cơn đau tim (Phần 4)"*
>   - *"Trào ngược dạ dày thực quản (GERD): Cách phân biệt với cơn đau tim (Phần 11)"*
>   - *"Thoái hóa khớp gối ở người trung niên: Bảo tồn sụn khớp không phẫu thuật (Phần 16)"*
>   - *"Chăm sóc và điều trị chuyên sâu chuyên khoa Y tế công cộng chuẩn y khoa (Phần 10)"*
> - **Tác động tiêu cực:** Tạo cảm giác "nội dung nhân tạo hàng loạt" (AI slop / template generator), làm giảm uy tín học thuật của trang thông tin y khoa đối với bệnh nhân và chuyên gia y tế.

### 3.3 Đánh giá Dịch vụ & Gói khám (Services & Packages)
* **Gói khám (Packages - 100 gói):** Rất xuất sắc. Cung cấp đầy đủ mục tiêu đối tượng, quy trình chuẩn bị (nhịn ăn, ngưng thuốc), danh mục khám chi tiết (Khám lâm sàng, Xét nghiệm công thức máu, Siêu âm tổng quát, Chụp X-quang tim phổi). Mức giá hợp lý, phù hợp thị trường y tế tư nhân Việt Nam.
* **Dịch vụ y tế (Services - 200 dịch vụ):** Thiếu trường giá tiền trên bảng `services` (giá hiện tại đang nằm trên `packages`). Cần bổ sung khung giá tham chiếu hoặc quy định BHYT theo đúng Thông tư quy định giá dịch vụ khám chữa bệnh của Bộ Y tế.

### 3.4 Câu hỏi Thường gặp (FAQs - 150 câu)
* 100% câu hỏi và câu trả lời mang nội dung thực tế (quy trình đặt lịch, bảo hiểm y tế, xét nghiệm lúc đói, hướng dẫn tái khám).
* Tuy nhiên, trường `category` đang bị bỏ trống (NULL) ở toàn bộ 145 FAQs active, khiến giao diện hiển thị danh sách phẳng trải dài thay vì được phân cụm thông minh theo từng chuyên khoa hoặc chủ đề.

---

## 4. Rủi ro Kỹ thuật Hạ tầng: N+1 Query Bottleneck trên Danh mục Bác sĩ

Trong quá trình thực hiện kiểm toán trực tiếp trên hệ thống Production, Advisor đã phát hiện một **lỗ hổng hiệu năng nghiêm trọng** đe dọa sự ổn định của hệ thống:

```
Endpoint: GET /api/v1/hospital/doctors?page=0&size=N
- size = 10:  200 OK  (Thời gian phản hồi: ~8.068 ms)
- size = 20:  200 OK  (Thời gian phản hồi: ~14.461 ms)
- size = 50:  502 Bad Gateway Timeout (Thời gian: > 25.400 ms)
```

### Nguyên nhân Kỹ thuật:
Trong `DoctorService.java` (dòng 85–86):
```java
private DoctorResponse toResponse(Doctor doctor) {
    List<DoctorBranch> branchLinks = doctorBranchRepository.findByDoctorId(doctor.getId());
    List<DoctorSpecialty> specialtyLinks = doctorSpecialtyRepository.findByDoctorId(doctor.getId());
    // ...
}
```
Khi client yêu cầu trang 50 bác sĩ:
1. Spring thực hiện 1 truy vấn lấy danh sách 50 bác sĩ.
2. Với mỗi bác sĩ, hệ thống bắn thêm **2 truy vấn độc lập** để lấy chi nhánh và chuyên khoa.
3. Tổng cộng phát sinh **101 truy vấn mạng** giữa Render (Frankfurt/Singapore) và Supabase (Tokyo), vượt ngưỡng timeout 25 giây của Gateway dẫn đến lỗi **HTTP 502 Bad Gateway**.

---

## 5. Kế hoạch Khắc phục & Kiến nghị Chuyên môn (Actionable Remediation Matrix)

| Mức độ Ưu tiên | Hạng mục Cần Khắc phục | Giải pháp Đề xuất | Trách nhiệm Phụ trách |
| :---: | :--- | :--- | :---: |
| **P0 (Khẩn cấp)** | Khắc phục N+1 query tại `DoctorService` | Sử dụng `@EntityGraph` hoặc `JOIN FETCH` trong JPQL / DTO Projection để gộp truy vấn branches & specialties thành 1 query duy nhất. | Backend Lead |
| **P0 (Khẩn cấp)** | Đồng bộ Chuyên khoa Bác sĩ với Tiểu sử | Chạy script SQL chuẩn hóa cập nhật lại `doctor_specialties` khớp với chuỗi chuyên khoa nêu trong `bio` của bác sĩ. | Data / Database Admin |
| **P1 (Quan trọng)** | Dọn dẹp "Hội chứng Phần X" trên Bài viết | Loại bỏ hậu tố `(Phần X)` vô nghĩa bằng regex, hợp nhất các bài trùng lặp thành một bài hoàn chỉnh duy nhất cho mỗi chủ đề bệnh học. | Content Lead |
| **P1 (Quan trọng)** | Bổ sung Banner Cấp cứu 115 trên Bài viết | Thêm `EmergencyCallout` màu đỏ nổi bật với số `115` trên các bài viết bệnh cấp tính (Đột quỵ, Nhồi máu cơ tim, Sốt co giật). | Frontend Lead |
| **P2 (Hoàn thiện)** | Phân loại Danh mục cho FAQs | Bổ sung `category` cho 150 FAQs (Tiếp đón & Đặt lịch, BHYT, Chuẩn bị trước khám, Hậu cần viện phí). | Product / Content |
| **P2 (Hoàn thiện)** | Dọn dẹp URL Unsplash trong DB Bác sĩ | Chạy câu lệnh `UPDATE doctors SET photo_url = NULL WHERE photo_url ILIKE '%unsplash%'` để triệt tiêu ảnh stock tại gốc dữ liệu. | Database Admin |

---

## 6. Phán quyết Chất lượng Tổng thể (Quality Verdict)

* **Về mặt Nội dung Y khoa & Pháp lý:** **ĐẠT (PASS)**  
  Dữ liệu bài viết có giá trị chuyên môn cao, viện dẫn đúng phác đồ Bộ Y tế và các hội chuyên ngành quốc tế. Đã triệt tiêu các phát ngôn tiếp thị quá đà gây rủi ro pháp lý.
* **Về mặt Trải nghiệm Người bệnh & An toàn:** **ĐẠT CÓ LƯU Ý (PASS WITH CAUTION)**  
  Giao thức FAST và cấp cứu nhồi máu cơ tim 15 phút được truyền tải chính xác. Cần bổ sung nút gọi 115 trực tiếp trên giao diện bài viết và sửa ngay lỗi cọc cạch chuyên khoa bác sĩ.
* **Về mặt Vận hành Hạ tầng Kỹ thuật:** **YÊU CẦU NÂNG CẤP TRƯỚC KHI TĂNG TẢI (GATE HOLD FOR N+1 REPAIR)**  
  Cần deploy ngay bản sửa lỗi N+1 Query trên endpoint danh mục bác sĩ để tránh sập Gateway khi lượng truy cập tăng cao.
