# Infrastructure HealthCare

[Getting started](../docs/getting-started.md) · [Local demo](../docs/local-demo-runbook.md) · [Operations](../docs/operations.md)

## Local Compose

[docker-compose.yml](docker-compose.yml) sở hữu dịch vụ, mạng, volumes, healthcheck và environment requirements. [Demo overlay](docker-compose.local-demo.yml) chọn local AI, demo UI và doctor fixture.

Chạy từ repo root, với .env đã được cấu hình:

~~~powershell
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml config --quiet
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml up -d --build
~~~

Không ghi đè env/volume của stack đang dùng. config --quiet không in resolved secret values; tên project giữ container/volume ownership tách khỏi stack khác.

## Network và integration boundary

Các dịch vụ web/backend/data gắn edge network và publish những cổng loopback được khai báo. Default network internal; AI chỉ gắn network này, không dùng edge network. Compose vẫn khai báo AI loopback host port mặc định 8000; khai báo ingress không tạo provider egress hoặc tự chứng minh host connectivity.

PostgreSQL/Redis/MinIO có named volumes. Mailpit chốt email local. Scanner adapter/ClamAV là private dependencies; storage flags, scan requirement và readiness vẫn độc lập. [Deployment local diagram](../docs/architecture/system-overview.md#deployment-local) minh họa topology.

`AI_SERVICE_HOST_PORT` là override của cổng AI loopback. Các host-port overrides và healthcheck chính xác nằm trong manifest; nếu host không kết nối được với AI trên internal network, kiểm tra authenticated health bên trong container.

## Seed và migrations

local-seed chạy sau backend health/Flyway. Base/large/rich-content/demo-doctor fixtures có scopes khác nhau; [Database guide](../docs/database/schema-overview.md) và [seed owners](../apps/backend/src/main/resources/db/seed) là điểm vào.

Không chạy seed để sửa production hoặc tự overwrite dữ liệu của người khác. Booking OTP fixed values chỉ thuộc test profile; local Compose giữ random OTP qua mail sink. [Demo runbook](../docs/local-demo-runbook.md) dẫn đến binding doctor khi cần tạo fixture dùng một lần.

## Backup và recovery

[backup-local-data.ps1](../scripts/backup-local-data.ps1) hỗ trợ project/env và output snapshot có manifest/hash. [restore-drill.ps1](../scripts/restore-drill.ps1) chạy trên throwaway containers. Một live object-store copy không thay được snapshot/recovery policy của production.

[Operations](../docs/operations.md#backup-và-phục-hồi) giải thích quy trình. Snapshot có thể chứa dữ liệu private; giữ ngoài Git và kiểm soát quyền truy cập.

## Hosted, images và test contracts

[render-free-beta.yaml](../render-free-beta.yaml) là nguồn hosted selection; local Compose không phải manifest production. [Infrastructure tests](tests) kiểm tra các contract; health/manifest green không thay live provider/browser evidence.

[Database fixture Dockerfile](database/Dockerfile) và [publish-database workflow](../.github/workflows/publish-database.yml) tạo package dữ liệu tổng hợp. Không thay database app/Flyway bằng fixture image chỉ vì nó có bảng sẵn. [Publish images](../.github/workflows/publish-images.yml) sở hữu image provenance/release checks.

[validate-production-env.ps1](../scripts/validate-production-env.ps1) kiểm tra cấu hình theo các guard của script. Nó không xác nhận cloud dashboard live, bank integration, hosted scanner hay recovery drill. Xem [Deployment](../docs/deployment.md).
