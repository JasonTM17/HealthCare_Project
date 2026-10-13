# Tài liệu HealthCare

Bộ tài liệu dành cho người đánh giá, developer mới và người vận hành. [README dự án](../README.md) có sản phẩm, GIF theo vai trò và hướng dẫn nhanh.

## Đường đọc đề xuất

| Mục đích | Thứ tự |
| --- | --- |
| Demo hoặc trình bày đồ án | [Sản phẩm](project-overview.md) → [Media](media-guide.md) → [Nghiệp vụ](business-workflows.md) |
| Chạy máy mới | [Getting started](getting-started.md) → [Demo runbook](local-demo-runbook.md) → [Testing](testing.md) |
| Tham gia phát triển | [Kiến trúc](architecture/system-overview.md) → [Database](database/schema-overview.md) → [API](api-reference.md) → [Contributing](contributing.md) |
| Làm với chatbot | [AI/RAG](ai-system.md) → [Security](security.md) → [AI service](../apps/ai-service/README.md) |
| Chuẩn bị release | [Operations](operations.md) → [Deployment](deployment.md) → [Testing](testing.md) |

## Tài liệu chuyên đề

| Chủ đề | Nguồn |
| --- | --- |
| Quyết định kiến trúc | [Foundation](architecture/foundation.md), [ADR index](adr/README.md) |
| CMS, preview, publish và realtime | [CMS realtime](architecture/cms-realtime.md), [TinyMCE](tinymce-integration.md) |
| Binding bác sĩ demo | [Doctor identity](doctor-portal-identity.md) |
| RAG local | [Local Postgres RAG](local-postgres-rag.md) |
| Kiểm thử giao diện render | [Rendered tests](frontend-rendered-tests.md) |
| Triển khai | [Deployment](deployment.md), [Beta notes](deployment-beta.md) |
| Projection | [Supabase](../supabase/README.md), [Reconciliation](../supabase/reconciliation/README.md) |

## Cách đọc bằng chứng

Mã nguồn, migration, manifest và tests sở hữu hành vi có thể thực thi. Tài liệu giải thích mục đích, đường đọc và các ranh giới; kiểm tra executable owner được liên kết khi cần xác nhận hành vi chính xác.

Ảnh/GIF local chứng minh màn hình đã render trong phiên ghi hình; không chứng minh mọi hành động trên màn hình đã được thực hiện. Sơ đồ deployment mô tả cấu hình trong repo, không tự xác nhận dashboard cloud hiện tại.

Thư mục `plans/` local lưu kế hoạch và bằng chứng theo snapshot, được Git bỏ qua. Không diễn giải test cũ hoặc plan completed thành chứng nhận production hiện tại. `PASS`, `FAIL`, `BLOCKED_CAPABILITY`, `NOT_RUN` giữ nguyên ý nghĩa khi báo cáo.
