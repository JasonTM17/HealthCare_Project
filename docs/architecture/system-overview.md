# Kiến trúc hệ thống HealthCare

[Tài liệu](../README.md) · [Luồng nghiệp vụ](../business-workflows.md) · [Database](../database/schema-overview.md)

## Cách đọc

Sơ đồ logic mô tả trách nhiệm và đường gọi được sở hữu bởi nguồn trong repo. Sơ đồ deployment mô tả hai môi trường khác nhau; không ghép tất cả dịch vụ local vào sơ đồ cloud như thể chúng đã được triển khai cùng nhau.

~~~mermaid
flowchart TB
    U["Khách · Bệnh nhân · Bác sĩ · Admin"] --> UI["Next.js UI / role portals"]
    UI --> BFF["Same-origin BFF / route handlers"]
    BFF -->|"Trusted HTTP + user session"| CORE["Spring Boot · modular monolith"]
    CORE -->|"Transactions / authority"| PG[("PostgreSQL · Flyway")]
    CORE -->|"Rate limit / wake-up"| REDIS[("Redis")]
    CORE -->|"Service-authenticated HTTP"| AI["FastAPI · retrieve / generate / validate"]
    CORE -->|"Feature-gated"| STORE["MinIO / S3 · private objects"]
    CORE -->|"Feature-gated"| SCAN["Scanner adapter + ClamAV"]
    CORE -. "Email / outbox khi bật" .-> MAIL["Mailpit local / configured SMTP"]
    AI --> MEM["Local memory RAG"]
    AI -. "Configured alternative" .-> PROJ["Protected Supabase RAG projection"]
    AI -. "Environment + policy gates" .-> LLM["Remote provider"]
~~~

Sơ đồ Mermaid hiển thị trực tiếp theo theme GitHub. [Nguồn chỉnh sửa](system-overview.mmd) cần được cập nhật cùng khối trên khi topology đổi; đường chấm thể hiện nhánh có điều kiện.

## Các tầng và trách nhiệm

| Tầng | Trách nhiệm | Executable owner |
| --- | --- | --- |
| UI | Public discovery, booking và portal theo role | [Next app](../../apps/frontend/app) |
| BFF | Same-origin API, trusted upstream, origin/headers/deadline và phản hồi browser | [healthcare-bff.ts](../../apps/frontend/lib/server/healthcare-bff.ts), [route handlers](../../apps/frontend/app/api) |
| Core | Auth, ownership, transaction, lifecycle và persistence | [Spring modules](../../apps/backend/src/main/java/com/healthcare) |
| AI | Routing, retrieval, generation và validation riêng | [FastAPI app](../../apps/ai-service/app) |
| Data | SQL business authority, transient coordination, object storage | [Migrations](../../apps/backend/src/main/resources/db/migration), [Compose](../../infrastructure/docker-compose.yml) |
| Workers | Mail, notifications, scan, sync/retry và retention | Module workers tương ứng; không mặc định là job cloud độc lập |

Backend là **modular monolith**: module chia theo nghiệp vụ trong một Spring application, không phải mỗi module là một microservice. FastAPI là dịch vụ riêng vì runtime và nhiệm vụ AI khác core. [ADR-001](../adr/ADR-001-modular-monolith.md) sở hữu rationale.

## BFF và xác thực

Browser gọi cùng origin website. BFF không phải quyền nghiệp vụ: một request qua đúng origin vẫn phải được Spring xác thực và kiểm tra role/ownership.

Browser session dùng cookie opaque do server quản lý. BFF service token chỉ thiết lập niềm tin giữa hai server, không đại diện quyền admin hoặc identity người bệnh. API JWT có hợp đồng riêng; không mô tả toàn bộ browser portal là JWT lưu trên client. [API/Auth](../api-reference.md#xác-thực-và-phiên-trình-duyệt).

## AI nằm sau Core

Spring gọi FastAPI qua service-authenticated HTTP. Public support và patient conversation có controller khác nhau. BFF không gọi trực tiếp một AI model để bỏ qua consent, quota hoặc source validation.

Hai bước retrieve/generate cho phép Core kiểm tra eligibility của nguồn trước khi generation. Các đường prepare/commit/lease phía nội bộ hỗ trợ giới hạn việc ghi câu trả lời khi request bị hủy. Việc có SSE route không tự chứng minh token streaming của provider; xem [AI system](../ai-system.md).

## Dữ liệu và các bản chiếu

**PostgreSQL** sở hữu hồ sơ, cuộc hẹn, session, nội dung, history và hàng đợi nghiệp vụ. **Redis** hỗ trợ rate-limit và wake-up realtime; không sở hữu bản xuất bản CMS hay toàn bộ lịch sử hội thoại.

**MinIO/S3** chứa object, còn quyền/linkage/scan metadata thuộc Core. Không gọi presigned URL là encryption-at-rest: đó là quyền truy cập có thời hạn, không chứng minh mã hóa vật lý.

**Supabase** có hai vai trò cần phân biệt: PostgreSQL hosting và protected RAG projection khi chọn durable adapter. Đây không phải mặc định một database thứ hai tự nhận bản sao tất cả dữ liệu SQL. [Supabase](../../supabase/README.md) và [reconciliation](../../supabase/reconciliation/README.md) sở hữu contract.

## Deployment local

~~~mermaid
flowchart LR
    Browser["Browser · localhost:3000"] --> FE["Next.js + BFF"]
    subgraph Edge["edge + internal networks"]
        FE --> BE["Spring Boot"]
        BE --> DB[("PostgreSQL volume")]
        BE --> Redis[("Redis volume")]
        BE --> Minio[("MinIO volume")]
        BE --> SMTP["Mailpit local sink"]
    end
    subgraph Internal["internal network only"]
        AI["FastAPI AI"]
        Scanner["Scanner adapter"] --> AV["ClamAV"]
    end
    BE -->|"Service HTTP"| AI
    BE -. "Feature-gated upload" .-> Scanner
~~~

Nguồn chỉnh sửa: [deployment-local.mmd](deployment-local.mmd). Executable owners: [Compose base](../../infrastructure/docker-compose.yml) và [demo overlay](../../infrastructure/docker-compose.local-demo.yml). Edge và internal ở sơ đồ là kết nối container, không phải đường public internet; cổng host loopback được mô tả bên dưới.

- Web, backend và local tools có cổng host loopback được cấu hình.
- AI chỉ ở network internal, không gắn edge network. Compose có khai báo host port loopback 8000 (override bằng `AI_SERVICE_HOST_PORT`); đây là cấu hình ingress, không tạo provider egress. Kiểm tra khả năng kết nối host trên runtime thực tế, không suy ra từ khai báo port.
- PostgreSQL, Redis và MinIO có volume; stop/start không xóa chúng.
- Mailpit là email sink local, không phải production SMTP.
- Scanner adapter/ClamAV là dependency cho tệp khi tính năng tương ứng được bật; có container healthy không chứng minh upload đã được phép.
- Demo overlay chọn local AI và cờ demo UI; không dùng overlay như manifest production.

## Deployment hosted theo repo

Nguồn lựa chọn hosted: [render-free-beta.yaml](../../render-free-beta.yaml), cùng [deployment notes](../deployment.md) và cấu hình FE tại [next.config.ts](../../apps/frontend/next.config.ts). Tên manifest có chữ beta không có nghĩa mọi comment hoặc cấu hình cũ vẫn hiện hành; đọc các khóa environment đang khai báo.

~~~mermaid
flowchart LR
    Browser[Browser] --> Web[Next.js / hosted frontend]
    Web --> Core[Render Spring service]
    Core --> SQL[(Hosted PostgreSQL)]
    Core --> Redis[(Configured Redis)]
    Core --> AI[Render FastAPI via HTTPS + service token]
    AI --> Rag[(Configured RAG adapter)]
    AI -. conditional .-> Provider[External provider]
~~~

Manifest hosted có các cờ provider khác Compose local. Trạng thái live, account/provider credentials, release gate và mức sẵn sàng phải kiểm tra trực tiếp tại môi trường; không suy ra từ YAML. Storage/mail/payment/scanner có thể bị đóng trong hosted contract dù UI/module tồn tại trong mã nguồn.

## Nội dung và thông báo

[CMS realtime](cms-realtime.md) phân biệt save draft, publish snapshot, event metadata và client reconciliation. Redis pub/sub là tín hiệu đánh thức; khi reconnect, PostgreSQL và public API cung cấp sự thật hiện tại.

Notification và email là hai kênh. Persist notification hoặc enqueue mail chưa chứng minh trình duyệt đã nhận hoặc SMTP đã deliver. [Operations](../operations.md) dẫn đến worker và runbook.

## Điểm cần giữ khi mở rộng

| Quyết định | Vì sao cần giữ |
| --- | --- |
| Role + ownership phía Core | UI ẩn nút không bảo vệ API |
| Backend-owned catalog IDs/actions | Model không được tự tạo doctor/slot/URL có quyền |
| Migration append-only | Bảo toàn checksum và recovery của database đã chạy |
| Public snapshot khác draft | Tránh lộ nội dung chưa được xuất bản |
| Provider flags theo môi trường | Local fallback không chứng minh hosted provider readiness |
| Runtime evidence khác source contract | Container, CI và cloud có snapshot riêng |

## Các sơ đồ liên quan

- [Booking/clinical/payment/governance](../business-workflows.md): sequence và state diagrams.
- [ERD](../database/schema-overview.md): identity/catalog, clinical/payment và AI.
- [AI flow](../ai-system.md): retrieval/eligibility/generation/commit.
- [Security](../security.md): trust boundary và negative cases.
