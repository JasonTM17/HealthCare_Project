# Hướng dẫn chạy demo cục bộ (local demo runbook)

Stack đầy đủ: website Next.js + backend Spring Boot + Postgres (có seed) +
AI service chatbot + Redis + Mailpit + MinIO + ClamAV + attachment-scanner.

Dùng project name riêng `healthcare-local-demo` để không đụng stack audit cũ.
Override `infrastructure/docker-compose.local-demo.yml` chỉ remap cổng host;
không sửa `.env` của repo.

## Khởi động

```bash
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml up -d --build
```

Chờ healthcheck xanh (~1-2 phút lần đầu):

```bash
docker ps --filter name=healthcare-local-demo --format "{{.Names}} | {{.Status}}"
```

## URL

| Dịch vụ | URL |
| --- | --- |
| Website | http://localhost:3000 |
| Backend health | http://localhost:8080/actuator/health |
| Mailpit (hộp thư demo) | http://localhost:8025 |
| MinIO console | http://localhost:9001 |
| Postgres | localhost:5434 (user `healthcare`, DB `healthcare`) |
| AI service | **không publish ra host** — mạng `internal` theo thiết kế cô lập egress. Kiểm tra: `docker exec healthcare-local-demo-ai-service-1 python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/livez').status)"` |

## Tài khoản seed

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Bệnh nhân | patient@healthcare.com | `HealthCare@2026` |
| Bác sĩ | doctor@healthcare.com | `HealthCare@2026` |
| Admin | admin@healthcare.com | `HealthCare@2026` |

## Kịch bản demo đã xác nhận

- **Đăng nhập**: cả 3 tài khoản trên đăng nhập qua web (`/login`) thành công.
- **Chatbot** (`/patient/chat` sau khi đăng nhập bệnh nhân): cả 3 mode trả lời
  — `HOSPITAL_SUPPORT` trả giờ làm việc thật của các cơ sở; `SYMPTOM_TRIAGE`
  có chế độ leo thang khẩn cấp (vd "đau ngực" → khuyên gọi 115) và từ chối
  an toàn khi không có nguồn; `HEALTH_EDUCATION` trả nội dung giáo dục sức khỏe
  đã duyệt.
- **An toàn AI**: gửi "tôi muốn chết" → bot trả lời khủng hoảng cảm thông +
  tạo notification `AI_SAFETY_ALERT` mà admin thấy trong chuông thông báo.
- **Email**: quên mật khẩu → email reset xuất hiện trong Mailpit :8025.
- **Dữ liệu bền**: `stop`/`start` giữ nguyên dữ liệu (volume `postgres-data`).

## Dừng / khởi động lại / reset

```bash
# Dừng (giữ dữ liệu)
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml stop

# Chạy lại (dữ liệu còn nguyên)
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml start

# Xoá sạch stack + database (seed chạy lại từ đầu ở lần up sau)
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml down -v
```

## Ghi chú vận hành

- Cổng host remap so với mặc định để tránh đụng: web 3000, backend 8080,
  Postgres 5434, Mailpit 8025/1026, MinIO 9000-9001, Redis 6379 (trong mạng).
- Không cần key AI bên ngoài: chế độ retrieval mặc định trả lời từ nội dung
  đã kiểm duyệt trong DB.
- Backend chỉ nhận request qua BFF của frontend — gọi API trực tiếp cần
  header BFF; dùng `http://localhost:3000/api/v1/...` kèm `Origin:
  http://localhost:3000` và cookie đăng nhập.

## Đăng nhập nhanh (tài khoản demo)

Trang `/login` local hiển thị khối "Tài khoản demo dùng để trải nghiệm" với 3 nút
Bệnh nhân / Bác sĩ / Quản trị viên (bấm để điền sẵn email + mật khẩu
`HealthCare@2026`). Khối này được bật lúc **build** image frontend bằng
`NEXT_PUBLIC_ENABLE_DEMO_LOGIN` và `NEXT_PUBLIC_ENABLE_DEMO_ADMIN`, đặt trong
`infrastructure/docker-compose.local-demo.yml`. Sau khi đổi hai biến này phải build lại:

```bash
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml up -d --build frontend
```

## Hồ sơ bác sĩ cho nút demo "Bác sĩ"

Nút demo đăng nhập bằng `doctor@healthcare.com`. Bước seed `infrastructure/seed-local-demo-doctor.sql`
(chạy sau seed chính trong `docker-compose.local-demo.yml`) gắn hồ sơ TS.BS Nguyễn Minh Khôi (có lịch hẹn mẫu)
cho tài khoản này; `doctor@healthcare.local` chuyển sang hồ sơ ThS.BS Trần Thu Hà. Chạy lại seed bất cứ lúc nào:

```bash
docker compose -p healthcare-local-demo --env-file .env \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local-demo.yml up --no-deps local-seed
```

Cùng bước seed này tạo 8 lịch `DEMO-LIVE-01..08` cho bác sĩ demo, tính theo ngày hôm nay (múi giờ Việt Nam):
2 lịch **Đang khám** (hiện nút "Ghi nhận kết quả khám"), 1 đã tiếp nhận, 5 đã xác nhận trong 3 ngày tới.
Mỗi lần chạy lại seed, các lịch này được dời về hôm nay và trả về trạng thái ban đầu.
