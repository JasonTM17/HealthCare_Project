<div align="center">

# HealthCare

### Nền tảng bệnh viện số cho bệnh nhân, bác sĩ và quản trị viên

Tìm dịch vụ, đặt lịch, theo dõi hồ sơ khám và vận hành bệnh viện trong một hệ thống; trợ lý AI hỗ trợ thông tin theo các ranh giới nguồn và quyền truy cập.

**Ngôn ngữ:** [Tiếng Việt](README.md) · [English](README.en.md)

[![CI](https://github.com/JasonTM17/HealthCare_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/JasonTM17/HealthCare_Project/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-111827?logo=nextdotjs)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

[Website](https://www.healthcare.id.vn) · [Tài liệu](docs/README.md) · [Chạy local](docs/getting-started.md) · [Kiến trúc](docs/architecture/system-overview.md)

</div>

> Ảnh và GIF được ghi từ stack demo local với dữ liệu giả lập. Chúng cho thấy giao diện đã render, không xác nhận thao tác đặt lịch, thanh toán, điều trị hay trạng thái của website đang triển khai. Trợ lý AI hỗ trợ thông tin; quyết định y tế thuộc nhân viên chuyên môn. [Nguồn gốc media](docs/media-guide.md).

## Mục lục

1. [Tổng quan sản phẩm](#tổng-quan-sản-phẩm)
2. [Trải nghiệm và GIF](#trải-nghiệm-và-gif)
3. [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
4. [Luồng nghiệp vụ và dữ liệu](#luồng-nghiệp-vụ-và-dữ-liệu)
5. [Trợ lý AI và ranh giới an toàn](#trợ-lý-ai-và-ranh-giới-an-toàn)
6. [Chạy dự án trên máy mới](#chạy-dự-án-trên-máy-mới)
7. [Công nghệ, mã nguồn và API](#công-nghệ-mã-nguồn-và-api)
8. [Kiểm thử và tài liệu chuyên sâu](#kiểm-thử-và-tài-liệu-chuyên-sâu)
9. [Đóng góp và giấy phép](#đóng-góp-và-giấy-phép)

## Tổng quan sản phẩm

HealthCare tổ chức hành trình khám trong một mô hình bệnh viện có nhiều chi nhánh. Người dùng khám phá chuyên khoa, bác sĩ và gói khám; chọn khung giờ; theo dõi cuộc hẹn và thông tin sau khám. Bác sĩ làm việc trong cổng lâm sàng riêng. Quản trị viên quản lý danh mục, nội dung, tài khoản và các hàng đợi cần quyết định của người có quyền.

| Vai trò | Hành trình trong ứng dụng | Điểm đọc tiếp |
| --- | --- | --- |
| Khách | Tìm cơ sở, chuyên khoa, bác sĩ, gói khám, bài viết và bắt đầu đặt lịch | [Luồng booking](docs/business-workflows.md#đặt-lịch-và-giữ-chỗ) |
| Bệnh nhân | Xem lịch hẹn, hồ sơ, đơn thuốc, kết quả, chăm sóc, thông báo và hội thoại AI | [Cổng bệnh nhân](docs/project-overview.md#bệnh-nhân) |
| Bác sĩ | Xem lịch khám, ghi nhận lâm sàng, tư vấn, kế hoạch chăm sóc và bài viết | [Cổng bác sĩ](docs/project-overview.md#bác-sĩ) |
| Quản trị | Quản lý danh mục, lịch, người dùng, CMS, kiểm duyệt AI và đối soát | [Cổng quản trị](docs/project-overview.md#quản-trị-viên) |

Chi nhánh trong sơ đồ dữ liệu là các đơn vị của **cùng một mô hình bệnh viện**; điều đó không tự chứng minh cô lập dữ liệu giữa nhiều bệnh viện độc lập. Quyền đọc hồ sơ được kiểm tra tại backend theo chủ sở hữu và liên kết chuyên môn. [Phạm vi và thuật ngữ](docs/project-overview.md) giải thích các vai trò.

## Trải nghiệm và GIF

Bốn tour dưới đây là video điều hướng trình duyệt thật, ghi trên `localhost:3000` từ dữ liệu seed giả lập rồi chuyển sang GIF. Mỗi tour chỉ mở màn hình; không tạo lịch, gửi chat, sửa hồ sơ, xuất bản nội dung hoặc phê duyệt tiền. [Media guide](docs/media-guide.md) ghi tuyến, kích thước, giới hạn và cách tái tạo.

### Khám phá dịch vụ

Trang chủ → Chuyên khoa → Bác sĩ → Gói khám → Đặt lịch.

![Tour khám phá dịch vụ](docs/assets/repo-tours/public-tour.gif)

| Trang chủ | Chuyên khoa |
| --- | --- |
| ![Trang chủ demo local](docs/assets/repo-tours/public-01.png) | ![Danh sách chuyên khoa](docs/assets/repo-tours/public-02.png) |
| **Bác sĩ** | **Trang đặt lịch** |
| ![Danh sách bác sĩ](docs/assets/repo-tours/public-03.png) | ![Giao diện đặt lịch](docs/assets/repo-tours/public-05.png) |

[Gói khám](docs/assets/repo-tours/public-04.png) · [Trang chủ ở viewport 390 px](docs/assets/repo-tours/public-mobile.png)

### Cổng bệnh nhân

Dashboard → Lịch hẹn → Lịch sử khám → Đơn thuốc → Trợ lý AI.

![Tour cổng bệnh nhân](docs/assets/repo-tours/patient-tour.gif)

| Tổng quan | Lịch hẹn |
| --- | --- |
| ![Dashboard bệnh nhân](docs/assets/repo-tours/patient-01.png) | ![Lịch hẹn của bệnh nhân](docs/assets/repo-tours/patient-02.png) |
| **Lịch sử khám** | **Trợ lý AI** |
| ![Lịch sử khám](docs/assets/repo-tours/patient-03.png) | ![Màn hình trợ lý AI](docs/assets/repo-tours/patient-05.png) |

[Đơn thuốc](docs/assets/repo-tours/patient-04.png)

### Cổng bác sĩ

Không gian lâm sàng → Lịch khám → Tư vấn → Kế hoạch chăm sóc → Bài viết.

![Tour cổng bác sĩ](docs/assets/repo-tours/doctor-tour.gif)

| Không gian lâm sàng | Lịch khám |
| --- | --- |
| ![Dashboard bác sĩ](docs/assets/repo-tours/doctor-01.png) | ![Lịch khám của bác sĩ](docs/assets/repo-tours/doctor-02.png) |
| **Tư vấn** | **Kế hoạch chăm sóc** |
| ![Danh sách tư vấn](docs/assets/repo-tours/doctor-03.png) | ![Kế hoạch chăm sóc](docs/assets/repo-tours/doctor-04.png) |

[Bài viết](docs/assets/repo-tours/doctor-05.png)

### Cổng quản trị

Điều hành → Bác sĩ → Người dùng → CMS → Kiểm duyệt AI → Đối soát thanh toán.

![Tour cổng quản trị](docs/assets/repo-tours/admin-tour.gif)

| Tổng quan vận hành | Danh bạ bác sĩ |
| --- | --- |
| ![Dashboard quản trị](docs/assets/repo-tours/admin-01.png) | ![Quản lý bác sĩ](docs/assets/repo-tours/admin-02.png) |
| **CMS** | **Đối soát thanh toán** |
| ![Quản lý nội dung CMS](docs/assets/repo-tours/admin-04.png) | ![Hàng đợi đối soát thanh toán](docs/assets/repo-tours/admin-06.png) |

[Người dùng](docs/assets/repo-tours/admin-03.png) · [Kiểm duyệt AI](docs/assets/repo-tours/admin-05.png)

## Kiến trúc hệ thống

Ứng dụng web dùng **Next.js** cho giao diện và các route BFF cùng origin. **Spring Boot** là nơi xác thực, kiểm tra quyền, xử lý giao dịch và lưu nghiệp vụ; đây là một modular monolith. **FastAPI** phục vụ retrieval/generation AI phía sau Core. PostgreSQL giữ dữ liệu nghiệp vụ; Redis dùng cho rate limit và tín hiệu realtime. Các tích hợp tệp, scanner và mail phụ thuộc cấu hình tính năng.

~~~mermaid
flowchart TB
    Browser["Khách / bệnh nhân / bác sĩ / admin"] --> UI["Next.js UI"]
    UI --> BFF["Same-origin BFF"]
    BFF -->|"Trusted HTTP + phiên người dùng"| Core["Spring Boot · modular monolith"]
    Core -->|"Giao dịch và dữ liệu nghiệp vụ"| SQL[("PostgreSQL + Flyway")]
    Core -->|"Rate limit / tín hiệu realtime"| Redis[("Redis")]
    Core -->|"Service-authenticated HTTP"| AI["FastAPI · AI service"]
    Core -. "Tính năng được bật" .-> Object["MinIO / S3 + scanner"]
    Core -. "Theo cấu hình" .-> Mail["Mail / notification"]
    AI --> Local["Local RAG"]
    AI -. "Adapter được chọn" .-> Projection["Protected RAG projection"]
    AI -. "Policy + environment" .-> Provider["Remote provider"]
~~~

**Ranh giới quan trọng:** browser không nhận service token; BFF không cấp quyền nghiệp vụ; Core vẫn kiểm tra vai trò và quyền sở hữu. Đường chấm thể hiện lựa chọn hoặc tính năng có điều kiện, không khẳng định mọi tích hợp đang chạy trên website. [Sơ đồ phân tầng, Compose và hosted](docs/architecture/system-overview.md) · [Auth/BFF](docs/api-reference.md#xác-thực-và-phiên-trình-duyệt).

### Topology local

~~~mermaid
flowchart LR
    User["Browser localhost:3000"] --> Web["Frontend + BFF"]
    Web --> Api["Spring API"]
    Api --> DB[("PostgreSQL")]
    Api --> Cache[("Redis")]
    Api --> AI["FastAPI trên network internal"]
    Api -. "Feature flag" .-> Files["MinIO + scanner"]
    Api -. "Local mail" .-> Inbox["Mailpit"]
~~~

Compose khai báo cổng AI loopback mặc định `127.0.0.1:8000` và AI gắn network internal; khai báo ingress này không tạo provider egress. Các cổng có thể đổi theo `.env`. [Compose base](infrastructure/docker-compose.yml) · [demo overlay](infrastructure/docker-compose.local-demo.yml) · [deployment chi tiết](docs/architecture/system-overview.md#deployment-local).

## Luồng nghiệp vụ và dữ liệu

### Đặt lịch: giữ chỗ trước khi xác nhận

Người dùng chọn slot; backend kiểm tra lịch bác sĩ và giữ chỗ có hạn trong transaction. Mã OTP xác nhận trước khi cuộc hẹn chuyển sang `CONFIRMED`. Khóa slot và ràng buộc PostgreSQL xử lý các request cạnh tranh; UI vô hiệu hóa nút không đủ để ngăn trùng.

~~~mermaid
sequenceDiagram
    actor Patient as Người đặt lịch
    participant Web as Browser / BFF
    participant Core as BookingService
    participant DB as PostgreSQL
    participant Mail as Email delivery
    Patient->>Web: Chọn bác sĩ, ngày và slot
    Web->>Core: POST /appointments/hold
    Core->>DB: Transaction + slot lock + validation
    alt Slot không hợp lệ hoặc đã bị chiếm
        Core-->>Web: Từ chối / xung đột
    else Hold hợp lệ
        Core->>DB: PENDING_CONFIRMATION + hạn giữ
        Core->>Mail: Gửi OTP (outbox khi bật)
        Core-->>Web: Booking code và thời hạn
        Patient->>Web: Nhập OTP
        Web->>Core: POST /appointments/confirm
        Core->>DB: Kiểm tra OTP, expiry và trạng thái
        Core-->>Web: CONFIRMED khi hợp lệ
    end
~~~

[BookingService](apps/backend/src/main/java/com/healthcare/appointment/service/BookingService.java), [slot locker](apps/backend/src/main/java/com/healthcare/appointment/service/PostgresAppointmentSlotLocker.java) và [luồng nghiệp vụ đầy đủ](docs/business-workflows.md#đặt-lịch-và-giữ-chỗ) là nguồn chính xác cho mọi nhánh và trạng thái.

### Quan hệ dữ liệu chính

Sơ đồ chỉ chọn các quan hệ giúp đọc hành trình bệnh nhân; schema đầy đủ thuộc [Flyway migrations](apps/backend/src/main/resources/db/migration). Dấu quan hệ tùy chọn không cấp quyền truy cập.

~~~mermaid
erDiagram
    users o|--o| patient_profiles : account_binding
    users o|--o| doctors : account_binding
    doctors ||--o{ doctor_branches : assigned
    branches ||--o{ doctor_branches : hosts
    doctors ||--o{ doctor_specialties : has
    specialties ||--o{ doctor_specialties : includes
    patient_profiles ||--o{ appointments : books
    doctors ||--o{ appointments : attends
    appointments o|--o| medical_records : encounter
    medical_records o|--o{ prescriptions : treatment
    appointments ||--o| bank_transfer_payments : payment
    appointments ||--o{ patient_care_plans : follow_up
~~~

PostgreSQL sở hữu appointment, hồ sơ, thanh toán, conversation history và CMS snapshot. Redis không thay thế SQL; object storage chứa tệp nhưng linkage/quyền và trạng thái quét thuộc Core. [ERD theo miền và migration](docs/database/schema-overview.md).

### Các quyết định cần người có quyền

| Tình huống | Điều kiện để chuyển trạng thái | Nguồn |
| --- | --- | --- |
| Cuộc hẹn | Hold, OTP, hết hạn, check-in và hủy theo quy tắc slot/owner | [Booking lifecycle](docs/business-workflows.md#vòng-đời-cuộc-hẹn) |
| Thanh toán chuyển khoản | Mã giao dịch hoặc webhook vào hàng đợi; duyệt/từ chối theo policy và audit | [Payment flow](docs/business-workflows.md#thanh-toán-và-đối-soát) |
| Nội dung CMS | Draft tách public snapshot; publish tạo version rồi client reconcile | [CMS realtime](docs/architecture/cms-realtime.md) |
| Nguồn AI lâm sàng | Revision/hash, approval, revoke và expiry quyết định eligibility | [AI governance](docs/business-workflows.md#kiểm-duyệt-nguồn-ai) |

## Trợ lý AI và ranh giới an toàn

Hỗ trợ công khai chỉ dùng thông tin bệnh viện phù hợp. Hội thoại bệnh nhân có chủ sở hữu, mode, consent, quota và lifecycle riêng. Một lượt tạo câu trả lời đi qua Core để kiểm tra nguồn trước khi dùng provider. Hướng dẫn khẩn cấp cố định được nhận diện sau kiểm tra owner và trước mode/current-consent gate; nhánh đó không gọi provider nhưng vẫn đi qua idempotency và commit control.

~~~mermaid
flowchart TB
    Request["Patient request"] --> Owner["Conversation owner"]
    Owner --> Emergency{"Khẩn cấp?"}
    Emergency -->|"Có"| Fixed["Hướng dẫn cố định"]
    Emergency -->|"Không"| Gate["Mode · consent · safety"]
    Gate -->|"Được phép"| Sources["Retrieve + source eligibility"]
    Gate -->|"Safety action"| Bounded["Câu trả lời có giới hạn"]
    Sources -->|"Nguồn hợp lệ"| Answer["Generation + validation"]
    Sources -->|"Thiếu nguồn"| Bounded
    Fixed --> Commit["Idempotency + permit + commit"]
    Bounded --> Commit
    Answer --> Commit
    Commit --> History[("Conversation history")]
~~~

SSE hoặc hiệu ứng đánh máy không tự chứng minh provider stream token thật. Nguồn công khai, RAG projection và dữ liệu y tế riêng có authority khác nhau. [AI/RAG contract](docs/ai-system.md) · [Security](docs/security.md) · [AI service](apps/ai-service/README.md).

## Chạy dự án trên máy mới

Cần Git và Docker Engine với Compose v2. Chạy từng service ngoài Docker cần Node/npm theo [frontend engines](apps/frontend/package.json), Java 21 và Python 3.12. Bắt đầu từ thư mục gốc repo; điền mọi biến server-only bắt buộc trong `.env` trước khi khởi động.

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Điền cấu hình bắt buộc theo docs/getting-started.md.
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml config --quiet
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml up -d --build
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml ps
~~~

Không chạy lệnh `up` khi ô bí mật bắt buộc còn trống hoặc khi tên project Compose trùng stack có dữ liệu cần giữ. [Getting started](docs/getting-started.md) mô tả preflight, biến môi trường, health check và cách tránh ghi đè stack hiện hữu.

| Điểm truy cập mặc định | Mục đích |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Website và BFF |
| [localhost:8080/actuator/health](http://localhost:8080/actuator/health) | Backend health |
| [localhost:8025](http://localhost:8025) | Mailpit local |
| [localhost:9001](http://localhost:9001) | MinIO console |
| `localhost:5434` | PostgreSQL host port của demo |

Tài khoản seed local: `patient@healthcare.com`, `doctor@healthcare.com`, `admin@healthcare.com`. Mật khẩu và binding hồ sơ thuộc [demo runbook](docs/local-demo-runbook.md); tài khoản seed không được suy ra là có trên website public.

## Công nghệ, mã nguồn và API

| Thành phần | Công nghệ | Nguồn |
| --- | --- | --- |
| Web và BFF | Next.js 16, React, TypeScript, Tailwind | [Frontend package](apps/frontend/package.json), [route handlers](apps/frontend/app/api) |
| Core API | Spring Boot 3.5, Java 21, Security, JPA, Flyway | [Backend POM](apps/backend/pom.xml), [modules](apps/backend/src/main/java/com/healthcare) |
| AI service | FastAPI, Python 3.12, retrieval/provider adapters | [Requirements](apps/ai-service/requirements.txt), [AI app](apps/ai-service/app) |
| Data và local tools | PostgreSQL 16, Redis, MinIO, Mailpit, scanner/ClamAV | [Compose](infrastructure/docker-compose.yml) |
| CI và infrastructure | GitHub Actions, Docker images, conditional hosted configuration | [Workflows](.github/workflows), [operations](docs/operations.md) |

| Thư mục | Trách nhiệm chính |
| --- | --- |
| [apps/frontend](apps/frontend) | UI, browser API/BFF và rendered tests |
| [apps/backend](apps/backend) | Nghiệp vụ, quyền, migration và Java tests |
| [apps/ai-service](apps/ai-service) | Routing AI, retrieval, generation và Python tests |
| [infrastructure](infrastructure) | Compose, scanner và local services |
| [supabase](supabase) | Projection/RLS và reconciliation theo cấu hình |
| [docs](docs/README.md) | Hướng dẫn và quyết định kỹ thuật |

Browser dùng đường `/api/v1/*` cùng origin; BFF chuyển request tin cậy đến Spring. Method, DTO và quyền cuối cùng thuộc controller/service, không thuộc bảng tóm tắt này.

| Nhóm API | Owner | Điều cần chú ý |
| --- | --- | --- |
| Auth và browser session | [AuthController](apps/backend/src/main/java/com/healthcare/auth/AuthController.java) | Cookie/CSRF khác JWT APIs |
| Danh mục và booking | [Hospital controllers](apps/backend/src/main/java/com/healthcare/hospital/controller), [AppointmentController](apps/backend/src/main/java/com/healthcare/appointment/controller/AppointmentController.java) | Public/role routes, hold, OTP, owner proof |
| Clinical và chăm sóc | [Clinical controllers](apps/backend/src/main/java/com/healthcare/clinical/controller), [Careplan controllers](apps/backend/src/main/java/com/healthcare/careplan/controller) | Patient/doctor linkage |
| Payment và CMS | [Payment controllers](apps/backend/src/main/java/com/healthcare/payment/controller), [CMS controllers](apps/backend/src/main/java/com/healthcare/cms/controller) | Audit, review và published snapshot |
| Public/patient AI | [PublicAiChatController](apps/backend/src/main/java/com/healthcare/ai/controller/PublicAiChatController.java), [AiConversationController](apps/backend/src/main/java/com/healthcare/ai/chat/controller/AiConversationController.java) | Hai bề mặt, nguồn và consent riêng |

[API reference](docs/api-reference.md) chỉ cách tìm method/path/DTO chính xác và phân biệt browser session, JWT, API public, API theo role và control plane nội bộ.

## Kiểm thử và tài liệu chuyên sâu

Chạy lệnh trong đúng thư mục của từng service và chuẩn bị môi trường theo [Testing](docs/testing.md). Bảng này là chỉ dẫn tái tạo, không phải tuyên bố toàn bộ suite vừa pass.

| Thành phần | Lệnh chính | Điều kiện |
| --- | --- | --- |
| Frontend | `npm ci`, `npm run verify` | Chạy trong `apps/frontend` |
| Backend | `.\mvnw.cmd -B verify` | Chạy trong `apps/backend` sau test preflight |
| AI | `python -m pytest`, `python -m ruff check .`, `python -m mypy` | Chạy trong `apps/ai-service` với requirements đã cài |

| Muốn đọc | Bắt đầu tại |
| --- | --- |
| Cài đặt và demo | [Getting started](docs/getting-started.md) · [local demo runbook](docs/local-demo-runbook.md) |
| Kiến trúc và quyết định | [System overview](docs/architecture/system-overview.md) · [ADR index](docs/adr/README.md) |
| Nghiệp vụ và dữ liệu | [Business workflows](docs/business-workflows.md) · [Database/ERD](docs/database/schema-overview.md) |
| API, phiên và bảo mật | [API reference](docs/api-reference.md) · [Security](docs/security.md) |
| AI, nguồn và consent | [AI system](docs/ai-system.md) · [AI service](apps/ai-service/README.md) |
| Kiểm thử và vận hành | [Testing](docs/testing.md) · [Operations](docs/operations.md) |
| Ảnh/GIF và provenance | [Media guide](docs/media-guide.md) · [metadata](docs/assets/repo-tours/provenance.json) |

## Đóng góp và giấy phép

Đọc [Contributing](docs/contributing.md) và [AGENTS.md](AGENTS.md) trước khi sửa repo. Ghi rõ môi trường và gate thực sự đã chạy khi đề xuất thay đổi. Mã nguồn được phát hành theo [MIT License](LICENSE).
