# Bắt đầu với HealthCare

[Tài liệu](README.md) · [Demo runbook](local-demo-runbook.md) · [Operations](operations.md)

## Chọn cách chạy

**Demo full stack:** dùng Compose để có web, backend, AI, PostgreSQL, Redis, mail và storage/scanner. **Phát triển từng dịch vụ:** chạy process riêng khi cần hot reload; vẫn phải cung cấp dependency và cấu hình trust boundary. Không dùng profile standalone làm bằng chứng tương đương PostgreSQL/Compose.

## Điều kiện

| Thành phần | Nguồn yêu cầu |
| --- | --- |
| Git, Docker Engine, Compose v2 | [Infrastructure](../infrastructure/README.md) |
| Node.js/npm khi chạy FE trực tiếp | `engines` trong [package.json](../apps/frontend/package.json) |
| JDK 21 khi chạy BE trực tiếp | [pom.xml](../apps/backend/pom.xml), Maven wrapper trong backend |
| Python 3.12 cho AI | [AI Dockerfile](../apps/ai-service/Dockerfile), [requirements](../apps/ai-service/requirements.txt) |

Thực hiện ví dụ dưới đây từ repo root. Với máy đã có stack/data, kiểm tra project name trước; không ghi đè `.env` và không chạy seed/reset chỉ để có ảnh demo.

## Cấu hình local

Tạo `.env` từ [.env.example](../.env.example) **chỉ khi file chưa tồn tại**:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Mẫu là danh sách khóa cấu hình, không phải môi trường đã sẵn sàng. Điền các giá trị bí mật ở máy local; không đưa chúng vào Git, screenshot hoặc báo cáo.

| Nhóm | Các khóa cần đọc | Mục đích |
| --- | --- | --- |
| Database | `DATABASE_*`, `POSTGRES_*` | Kết nối process và container đúng mạng |
| Browser/BFF | `BACKEND_BFF_SERVICE_TOKEN`, `BACKEND_BFF_REQUIRED`, `BFF_ALLOWED_ORIGINS` | FE server và Spring chia sẻ trust token; client không giữ token |
| Auth | `JWT_SECRET`, TTL và Google client configuration khi dùng OAuth | Không nhầm Google client ID với server secrets |
| AI | `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, runtime, ingest và provider flags | Compose dùng internal AI; không cần tự bật remote để demo |
| Email | `APP_MAIL_OUTBOX_ENCRYPTION_KEY`, `APP_MAIL_*` | Outbox và SMTP; local Compose chốt Mailpit |
| Scanner/storage | `STORAGE_AV_SERVICE_TOKEN`, endpoint/bucket và feature flags | Có container không đồng nghĩa uploads đã bật |

Các biến có dấu `:?` trong [Compose](../infrastructure/docker-compose.yml) là điều kiện startup bắt buộc. Giá trị token và encryption key phải tuân theo validator của backend; xem [application config](../apps/backend/src/main/resources/application.yml). Không thay toàn bộ khóa bằng cùng một chuỗi tùy ý.

## Khởi động demo

```powershell
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml config --quiet
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml up -d --build
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml ps
```

`config --quiet` kiểm tra cấu hình mà không in các giá trị đã resolve. Không đưa output của `docker compose config` đầy đủ vào issue/chat vì có thể chứa secrets.

Mở website `http://localhost:3000`, đăng nhập theo [runbook demo](local-demo-runbook.md). Trên máy có xung đột cổng, cấu hình host-port keys theo Compose thay vì sửa URL server nội bộ. Backend gọi AI bằng Docker DNS. Compose khai báo AI host port loopback mặc định 8000 qua `AI_SERVICE_HOST_PORT`, nhưng AI chỉ gắn network internal; kiểm tra readiness trong container nếu host không kết nối được.

### Kiểm tra sẵn sàng

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health
Invoke-WebRequest http://localhost:3000
```

HTTP thành công chỉ là kiểm tra kết nối. Tiếp theo mở web, đăng nhập một tài khoản demo và kiểm tra heading/dữ liệu của role. AI `/livez` cho biết process sống; authenticated `/health` xác nhận readiness, không tự chứng minh một lượt provider thật.

## Phát triển process riêng

| Dịch vụ | Điểm vào |
| --- | --- |
| Frontend | [Frontend README](../apps/frontend/README.md); `npm ci` rồi `npm run dev` trong apps/frontend |
| Backend | [Backend README](../apps/backend/README.md); scripts [run standalone](../scripts/run-standalone-backend.ps1), [start local](../scripts/start-be-local.ps1) có scope khác nhau |
| AI | [AI README](../apps/ai-service/README.md); tạo venv, cài requirements, chạy uvicorn theo README |

Container origin và browser origin không hoán đổi được: backend trong Compose dùng hostname dịch vụ, browser dùng origin website, storage có endpoint ký URL riêng. [Architecture](architecture/system-overview.md) giải thích network boundary.

## Dừng và giữ dữ liệu

```powershell
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml stop
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml start
```

Volume giữ dữ liệu. `down -v` xóa volume; chỉ dùng khi chủ sở hữu quyết định hủy môi trường dùng một lần. Không dùng nó như bước sửa lỗi startup. Đọc [backup/recovery](operations.md#backup-và-phục-hồi) trước thao tác dữ liệu.

## Lỗi thường gặp

| Triệu chứng | Bước đầu |
| --- | --- |
| Startup báo thiếu variable | Kiểm tra tên khóa trong `.env.example` và điều kiện `:?`; không in giá trị |
| FE chạy nhưng API 403 | Kiểm tra token server-to-server, origin và session/CSRF đúng luồng |
| Backend health 503 | Xem AI readiness, service token và dependency health |
| Bác sĩ không thấy lịch mẫu | Kiểm tra binding theo [doctor identity](doctor-portal-identity.md), không đổi role bừa |
| Mail reset chưa nhận | Kiểm tra outbox worker và Mailpit; accepted request khác delivered mail |
| Upload hoặc payment bị từ chối | Kiểm tra feature/deployment flags trước khi cho rằng UI lỗi |

Các bước chẩn đoán chi tiết nằm trong [Operations](operations.md). Kiểm thử môi trường test tách khỏi demo và được mô tả trong [Testing](testing.md).
