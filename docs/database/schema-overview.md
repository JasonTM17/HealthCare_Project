# Database và mô hình dữ liệu

[Tài liệu](../README.md) · [Nghiệp vụ](../business-workflows.md) · [Kiến trúc](../architecture/system-overview.md)

## Authority và cách đọc ERD

[Flyway migrations](../../apps/backend/src/main/resources/db/migration) sở hữu schema hiện tại. ERD dưới đây chọn các quan hệ chính để đọc miền, không liệt kê toàn bộ cột/index. Khi viết query hoặc migration, đọc toàn bộ migration sequence và entity/repository thay vì copy bản tóm tắt.

**Business SQL** là nguồn gốc dữ liệu. **RAG projection** chỉ phục vụ retrieval theo contract. Redis và object storage không thay thế các quan hệ quyền sở hữu trong PostgreSQL.

## Identity và catalog

~~~mermaid
erDiagram
    users ||--o{ user_roles : assigned
    roles ||--o{ user_roles : membership
    roles ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : permission
    users ||--o{ refresh_tokens : owns
    users o|--o| doctors : account_binding
    users o|--o| patient_profiles : account_binding
    doctors ||--o{ doctor_specialties : has
    specialties ||--o{ doctor_specialties : includes
    doctors ||--o{ doctor_branches : assigned
    branches ||--o{ doctor_branches : hosts
~~~

Nguồn: [V1 identity/RBAC](../../apps/backend/src/main/resources/db/migration/V1__identity_rbac_baseline.sql), [V2 catalog](../../apps/backend/src/main/resources/db/migration/V2__hospital_domain.sql), [V5 account linkage](../../apps/backend/src/main/resources/db/migration/V5__clinical_records_and_authorization.sql). Browser sessions là contract bổ sung sau nền tảng; [BrowserSessionService](../../apps/backend/src/main/java/com/healthcare/auth/service/BrowserSessionService.java) dẫn đến persistence owner.

Binding user–doctor/patient có thể nullable với legacy/seed rows. Tài khoản đăng nhập không tự tạo một hồ sơ chuyên môn có lịch; đây là lý do cần [doctor identity guide](../doctor-portal-identity.md).

## Appointment, clinical và payment

~~~mermaid
erDiagram
    patient_profiles ||--o{ appointments : books
    doctors ||--o{ appointments : attends
    branches o|--o{ appointments : location
    appointments o|--o| medical_records : encounter
    patient_profiles ||--o{ medical_records : owner
    doctors ||--o{ medical_records : clinician
    medical_records o|--o{ prescriptions : treatment
    prescriptions ||--o{ prescription_items : contains
    patient_profiles ||--o{ diagnostic_results : receives
    appointments ||--o| bank_transfer_payments : payment
    bank_transfer_payments ||--o| payment_invoices : receipt
    appointments ||--o{ patient_care_plans : follow_up
    patient_care_plans ||--o{ patient_care_plan_items : contains
~~~

Quan hệ optional thể hiện FK nullable hoặc dữ liệu chưa được tạo, không tự mô tả quyền truy cập. Prescriptions/diagnostics/care plans có thêm owner/clinician links; đọc migration/entity để dùng đầy đủ constraints.

Nguồn: [V4 booking](../../apps/backend/src/main/resources/db/migration/V4__appointments.sql), [V5 clinical](../../apps/backend/src/main/resources/db/migration/V5__clinical_records_and_authorization.sql), [payment entities](../../apps/backend/src/main/java/com/healthcare/payment/entity), [careplan module](../../apps/backend/src/main/java/com/healthcare/careplan), [migrations](../../apps/backend/src/main/resources/db/migration).

### Scheduling invariants

Lịch bác sĩ và exception gắn với doctor/branch assignment. Appointment slot phải hợp lệ với lịch và trạng thái bác sĩ. Các migration về normalization/active-slot uniqueness/interval exclusion bảo vệ dữ liệu khi request cạnh tranh.

Ngày trong tuần của scheduling dùng ISO-8601 theo migration V9: Monday=1 đến Sunday=7. Không mang quy ước timetable của một dự án khác vào schema này. Appointment times/audit timestamps và lịch theo giờ địa phương có mục đích khác nhau; [business-time.ts](../../apps/frontend/lib/business-time.ts) sở hữu phía FE và migration/service sở hữu phía BE.

Hết hạn giữ chỗ được lưu thành lifecycle/history theo service, không xóa hàng loạt appointment để “dọn trùng”. [BookingService](../../apps/backend/src/main/java/com/healthcare/appointment/service/BookingService.java) và [slot locker](../../apps/backend/src/main/java/com/healthcare/appointment/service/PostgresAppointmentSlotLocker.java) là đường đọc.

## Hội thoại AI

~~~mermaid
erDiagram
    users ||--o{ ai_conversations : owns
    ai_conversations ||--o{ ai_messages : history
    ai_messages o|--o| ai_messages : request_response
    ai_messages ||--o| ai_message_feedback : feedback
~~~

[V26 conversation baseline](../../apps/backend/src/main/resources/db/migration/V26__patient_ai_conversations.sql) tạo history; [V34 mode/consent/review](../../apps/backend/src/main/resources/db/migration/V34__patient_ai_chat_and_clinical_review.sql) bổ sung contract. Processing lease, source eligibility và credits được bổ sung bởi migration/module riêng; không ép chúng vào một ERD quá dày.

Nguồn: [chat entities](../../apps/backend/src/main/java/com/healthcare/ai/chat/entity), [AiCreditService](../../apps/backend/src/main/java/com/healthcare/ai/service/AiCreditService.java), [review service](../../apps/backend/src/main/java/com/healthcare/ai/service/AiClinicalReviewService.java).

## CMS, notifications và outboxes

Các miền này có nguồn nghiệp vụ riêng:

| Miền | SQL dùng để làm gì | Owner |
| --- | --- | --- |
| CMS | Working state, published snapshot, revision/change metadata | [CMS module](../../apps/backend/src/main/java/com/healthcare/cms) |
| Notification | Nội dung/quyền đọc/preferences và delivery bookkeeping | [Notification](../../apps/backend/src/main/java/com/healthcare/notification) |
| Email outbox | Delivery state, encrypted payload và idempotency | [Auth mail](../../apps/backend/src/main/java/com/healthcare/auth/mail) |
| Clinical AI outbox | Revision/eligibility sync và tombstone | [AI services](../../apps/backend/src/main/java/com/healthcare/ai/service) |
| Payment webhook/audit | Event handling, retry/dead-letter và quyết định | [Payment](../../apps/backend/src/main/java/com/healthcare/payment) |
| Attachment scan | Lease/status/linkage trước khi phục vụ object | [Storage](../../apps/backend/src/main/java/com/healthcare/storage) |

Outbox tồn tại không đồng nghĩa delivery xong. Replay/retry cần idempotency và state đúng contract; không nhập lại seed để bỏ qua một hàng đợi lỗi.

## Migration và fixture

- Không sửa checksum SQL đã được áp dụng. Thay đổi schema qua migration mới và kiểm tra clean-chain/upgrade-path tương ứng.
- Không bật out-of-order tùy tiện khi Flyway lỗi; kiểm tra history, backup và runbook trước.
- Migration có seed tổng hợp vẫn là một phần contract đã áp dụng; không chạy seed production tùy ý.
- [Large-data seed](../../apps/backend/src/main/resources/db/seed/seed-large-data.sql) và [demo overlay](../../infrastructure/docker-compose.local-demo.yml) có phạm vi local khác nhau.
- [Database image Dockerfile](../../infrastructure/database/Dockerfile) và [publish workflow](../../.github/workflows/publish-database.yml) sở hữu fixture package. Fixture image không tự thay được database do app/Flyway quản lý.

Tài liệu không ghi một tổng số migration/tables cố định vì số đó dễ lỗi thời. Liệt kê từ owner khi cần:

~~~powershell
rg --files apps/backend/src/main/resources/db/migration
rg -n 'CREATE TABLE|ALTER TABLE' apps/backend/src/main/resources/db/migration
~~~

## Supabase projection và recovery

Đọc [Supabase README](../../supabase/README.md) và [reconciliation](../../supabase/reconciliation/README.md) trước schema/RLS/RPC work. Primary database trên Supabase và RAG adapter chọn Supabase là các quyết định cấu hình khác nhau.

Backup phải có cả SQL và objects/linkage nếu cần phục hồi tài liệu. [Operations](../operations.md#backup-và-phục-hồi) dẫn đến backup/restore owners; test unit không chứng minh recovery của data volume thật.
