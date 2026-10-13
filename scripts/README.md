# Công cụ phát triển và vận hành

[Tài liệu](../docs/README.md) · [Getting started](../docs/getting-started.md) · [Testing](../docs/testing.md) · [Operations](../docs/operations.md)

Các script trong thư mục này phục vụ khởi động, kiểm tra môi trường, sao lưu và tái tạo fixture hoặc tài sản của dự án. Đọc parameters và target environment trong script trước khi chạy; một số lệnh tạo dữ liệu, khởi động container hoặc ghi file.

## Chọn công cụ theo mục đích

| Mục đích | Owner | Hướng dẫn |
| --- | --- | --- |
| Khởi động và xác minh Compose local | [start-and-verify-local-mvp.ps1](start-and-verify-local-mvp.ps1), [verify-local-mvp.ps1](verify-local-mvp.ps1) | [Local runbook](../docs/LOCAL_RUNBOOK.md) |
| Khởi động từng service | [run-standalone-backend.ps1](run-standalone-backend.ps1), [start-be-local.ps1](start-be-local.ps1), [start-ai-local.ps1](start-ai-local.ps1) | [Getting started](../docs/getting-started.md) |
| Khởi động Docker an toàn | [start-docker-safe.ps1](start-docker-safe.ps1), [runtime helper](lib/DockerSafeRuntime.psm1), [launcher installer](install-docker-safe-launcher.ps1) | Parameters trong script |
| Kiểm tra dependency của backend tests | [PowerShell preflight](check-backend-test-preflight.ps1), [shell preflight](check-backend-test-preflight.sh) | [Testing](../docs/testing.md#backend) |
| Cấu hình và provenance | [validate-production-env.ps1](validate-production-env.ps1), [local-mvp-provenance.ps1](local-mvp-provenance.ps1), [chatbot freshness](verify-compose-chatbot-freshness.ps1) | [Operations](../docs/operations.md) |
| Sao lưu và diễn tập phục hồi | [backup-local-data.ps1](backup-local-data.ps1), [restore-drill.ps1](restore-drill.ps1) | [Backup guide](../docs/operations.md#backup-và-phục-hồi) |
| Kiểm tra DB và phân tích fixture SQL | [verify-local-db.py](verify-local-db.py), [fixture analysis](analyze-migration-fixture.py), [cleanup-table analysis](find-missing-cleanup-tables.py) | [Database guide](../docs/database/schema-overview.md) |
| Đồng bộ manifest CMS | [sync-cms-page-manifest.mjs](sync-cms-page-manifest.mjs) | [CMS architecture](../docs/architecture/cms-realtime.md) |
| Tạo nội dung và media minh họa | [seed-rich-content.mjs](seed-rich-content.mjs), [article illustrations](generate-article-illustrations.mjs), [event images](generate_event_images.py) | Target và dependencies trong từng script |

Fixture V86 được version tại [v86-catalog-prerequisites.sql](../apps/backend/src/main/resources/db/catalog/v86-catalog-prerequisites.sql). [generate-v86-fixture.py](generate-v86-fixture.py) là helper bảo trì cần đầu vào local: ngoài SQL trong `local-dev-repair/`, nó còn đọc `07-cms-contents-for-v86.sql`, hiện không được phân phối trong repo. Clone mới có fixture đã commit; chạy lại helper hoặc `--check` cần cung cấp đủ đầu vào local trước. [README của thư mục SQL](local-dev-repair/README.md) giải thích việc sửa database local cũ.

## Media và kết quả theo phiên

[Capture và convert tools](../docs/media-tools) sở hữu các tour theo vai trò trong README; xem [Media guide](../docs/media-guide.md) trước khi ghi hình. Probe theo đợt audit, script phụ thuộc đường dẫn máy cá nhân và pipeline media cũ được giữ local, ngoài Git. Kết quả kiểm thử và backup cũng ở ngoài source; ghi rõ command, target và snapshot khi báo cáo.
