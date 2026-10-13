# Sản phẩm và phạm vi HealthCare

[Tài liệu](README.md) · [Nghiệp vụ](business-workflows.md) · [Kiến trúc](architecture/system-overview.md)

## Mục tiêu

HealthCare kết nối việc khám phá dịch vụ, đặt lịch và theo dõi sau khám trong một website. Bệnh nhân theo dõi hành trình của mình; bác sĩ làm việc với ca được liên kết; quản trị viên quản lý danh mục, tài khoản, nội dung và các hàng đợi vận hành.

Đơn vị tổ chức là bệnh viện với nhiều chi nhánh. `branch` phục vụ địa điểm, danh mục bác sĩ và lịch; không phải bằng chứng rằng hệ thống có tenant isolation giữa nhiều tổ chức độc lập.

Dữ liệu demo và tài liệu lâm sàng tổng hợp phục vụ phát triển/trình bày. Việc mở môi trường cho dữ liệu thật cần quyết định và bằng chứng vận hành riêng. [Synthetic clinical documents ADR](adr/ADR-005-synthetic-clinical-documents.md) giải thích ranh giới tài liệu minh họa.

## Hành trình theo vai trò

### Khách

Khách tìm cơ sở, chuyên khoa, bác sĩ, dịch vụ/gói khám, bài viết và FAQ. Trang đặt lịch bắt đầu hành trình chọn nơi khám và khung giờ; xác nhận và quyền tra cứu lịch là các bước khác nhau.

Điểm vào: [public pages](../apps/frontend/app), [booking page](../apps/frontend/app/dat-lich/page.tsx), [hospital controllers](../apps/backend/src/main/java/com/healthcare/hospital/controller). Chat công khai thuộc [PublicAiChatController](../apps/backend/src/main/java/com/healthcare/ai/controller/PublicAiChatController.java), không phải hội thoại bệnh nhân lưu lịch sử.

### Bệnh nhân

Dashboard gom lịch hẹn, lịch sử khám, đơn thuốc, kết quả, hồ sơ và thông báo. Các route tương thích như `/patient/medical-records` hoặc `/patient/prescriptions` chuyển về tab tương ứng trong dashboard; tab là một phần của URL fragment.

Các trải nghiệm riêng: tư vấn, tài liệu, chăm sóc, cộng đồng/hỏi đáp, tùy chọn và AI. Xem [patient routes](../apps/frontend/app/patient), [PatientPortalController](../apps/backend/src/main/java/com/healthcare/clinical/controller/PatientPortalController.java) và [patient chat](../apps/frontend/app/patient/chat/page.tsx).

Mục tiêu quyền truy cập: một người xem dữ liệu gắn với hồ sơ của họ. Biết booking code, record UUID hoặc URL không đồng nghĩa có quyền đọc. Xem [Security](security.md).

### Bác sĩ

Không gian lâm sàng tập trung lịch khám và công việc liên quan. Bác sĩ có các màn hình lịch hẹn, tư vấn, kế hoạch chăm sóc, bài viết, thông báo, hồ sơ và review nội dung AI.

Đọc từ [doctor routes](../apps/frontend/app/doctor) → [DoctorPortalController](../apps/backend/src/main/java/com/healthcare/clinical/controller/DoctorPortalController.java) → [ClinicalService](../apps/backend/src/main/java/com/healthcare/clinical/service/ClinicalService.java). Binding tài khoản và hồ sơ chuyên môn là hai đối tượng khác nhau; [doctor identity](doctor-portal-identity.md) là hướng dẫn chẩn đoán khi lịch bác sĩ trống.

### Quản trị viên

Quản trị gồm điều hành, danh mục/cơ sở/chuyên khoa/bác sĩ/dịch vụ, lịch, tài khoản, CMS, thanh toán, tuyển dụng, hỏi đáp và credits/review AI.

Điểm vào: [admin routes](../apps/frontend/app/admin), [admin hospital controllers](../apps/backend/src/main/java/com/healthcare/hospital/controller), [CMS](../apps/backend/src/main/java/com/healthcare/cms), [payments](../apps/backend/src/main/java/com/healthcare/payment), [AI governance](../apps/backend/src/main/java/com/healthcare/ai).

Quản trị nội dung và quyền điều trị là các loại quyền khác nhau. Không diễn giải danh sách màn hình admin thành quyền truy cập vô hạn vào mọi hồ sơ lâm sàng.

## Thuật ngữ miền

| Thuật ngữ | Ý nghĩa để đọc dự án |
| --- | --- |
| Branch | Cơ sở khám thuộc danh mục bệnh viện |
| Specialty | Chuyên khoa; khác bác sĩ và dịch vụ |
| Doctor profile | Hồ sơ chuyên môn; cần binding user để làm việc ở portal |
| Patient profile | Hồ sơ người bệnh; khác tài khoản đăng nhập |
| Slot / hold | Khung giờ và giữ chỗ có thời hạn trước khi xác nhận |
| Appointment | Cuộc hẹn với lifecycle riêng |
| Medical record | Ghi nhận ca khám, không thay thế mọi dữ liệu sức khỏe |
| Consultation | Trao đổi có participants, khác hội thoại AI |
| Care plan | Kế hoạch theo dõi và các việc cần làm sau khám |
| Payment verification | Quyết định đối soát, khác việc bệnh nhân khai báo đã chuyển tiền |
| CMS draft / published | Bản làm việc và bản được phép phục vụ công khai |
| RAG projection | Bản chiếu dùng retrieval; không thay thế dữ liệu nghiệp vụ gốc |
| Consent | Đồng ý cho một hợp đồng hội thoại, không phải giấy phép bỏ qua ownership |
| Provenance | Nguồn xử lý của câu trả lời; khác chất lượng lâm sàng và trạng thái provider |

## Cách trình bày demo

1. Giới thiệu nhu cầu và vai trò.
2. Dùng [tour public](assets/repo-tours/public-tour.gif) cho discovery.
3. Dùng tour bệnh nhân, bác sĩ và admin để thấy sự liên kết giữa các không gian.
4. Giải thích [booking/payment state diagrams](business-workflows.md), rồi [architecture](architecture/system-overview.md).
5. Nêu môi trường demo và giới hạn evidence; không suy ra chứng nhận y tế, thanh toán thật hoặc release readiness từ ảnh chụp.

## Nguồn chính xác

UI routes thể hiện nơi người dùng làm việc; controller/service thể hiện ranh giới nghiệp vụ; migration xác định data contract. [API](api-reference.md) và [Database](database/schema-overview.md) dẫn đến các nguồn này. Các tính năng phụ thuộc cấu hình được giải thích trong [Operations](operations.md).
