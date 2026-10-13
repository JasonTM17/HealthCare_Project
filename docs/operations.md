# Vận hành và phục hồi

[Tài liệu](README.md) · [Getting started](getting-started.md) · [Deployment](deployment.md)

## Chọn đúng môi trường

Local Compose có dependency đầy đủ và AI nội bộ. Hosted manifest có topology/feature/provider khác. Một UI/module trong repo không chứng minh dịch vụ tích hợp đã bật trong môi trường đang vận hành.

Nguồn: [Compose](../infrastructure/docker-compose.yml), [demo overlay](../infrastructure/docker-compose.local-demo.yml), [hosted Render manifest](../render-free-beta.yaml), [deployment notes](deployment.md). Xác nhận source SHA, image digest/revision và environment trước khi ghi “verified”. Label image `unknown` không được coi là parity với HEAD.

## Health và quan sát

```powershell
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml ps
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml logs --tail 80 backend
```

Log có thể chứa dữ liệu/identity; xem local, redact trước khi gửi báo cáo. Không in resolved Compose config hoặc environment secrets.

| Tín hiệu | Chứng minh | Chưa chứng minh |
| --- | --- | --- |
| Container healthy | Healthcheck khai báo thành công | Browser workflow hoặc provider lượt thật |
| AI livez | Process sống | Authenticated readiness và retrieval đúng |
| AI health | Readiness theo contract/config | Quota/provider/accounting thực tế |
| Backend health | Dependency health theo app contract | Mọi endpoint/role đều đúng |
| Website HTTP 200 | Kết nối/response | Trang đã render đúng, user thao tác thành công |
| Queue/outbox row | Trạng thái được persist | Browser notification hoặc SMTP delivery |

## Runbook theo triệu chứng

| Triệu chứng | Probe đầu tiên | Điểm đọc tiếp |
| --- | --- | --- |
| Login 403 | Origin, trusted BFF, CSRF/session contract | [API/Auth](api-reference.md), [auth security](../apps/backend/src/main/java/com/healthcare/auth/security) |
| Login được nhưng role portal sai/trống | Current identity và doctor/patient binding | [doctor identity](doctor-portal-identity.md) |
| Chat chờ lâu/503 | Core/AI readiness, deadline và nguồn eligible | [AI](ai-system.md), [BFF](../apps/frontend/lib/server/healthcare-bff.ts) |
| Người xem vẫn thấy CMS cũ | Public snapshot/version, no-store, poll/reconnect | [CMS realtime](architecture/cms-realtime.md) |
| Email chưa tới | Enqueue vs sent state, worker, Mailpit/SMTP | [mail module](../apps/backend/src/main/java/com/healthcare/auth/mail) |
| Payment chờ đối soát | Queue/audit/appointment state và đúng actor | [payment workflow](business-workflows.md#thanh-toán-và-đối-soát) |
| Upload từ chối | Feature flags, MIME/size, scanner readiness và owner | [Security](security.md#tệp-đính-kèm) |
| Flyway không boot | History/checksum/upgrade path, không reset volume | [Database](database/schema-overview.md) |

Các cold-start/deadline constants có owner trong source; không chép một con số latency cũ thành SLA. Retry mutation cần theo contract của operation, không retry mù vì request timeout.

## Backup và phục hồi

[backup-local-data.ps1](../scripts/backup-local-data.ps1) là owner cho backup local có project/env parameters và output manifest. [restore-drill.ps1](../scripts/restore-drill.ps1) phục hồi snapshot vào container dùng một lần để kiểm tra hashes/relational integrity và đo RPO/RTO.

1. Xác nhận project/database/bucket/volume thật cần backup.
2. Đọc script parameters và output location; giữ snapshot ngoài Git, kiểm soát quyền truy cập.
3. Chạy backup được phép, kiểm tra manifest/hash và phạm vi SQL/objects.
4. Rehearsal restore trong môi trường dùng một lần; không restore đè hệ thống chính để “thử”.
5. Khi phục hồi thật, owner quyết định stop traffic, target, thời điểm dữ liệu và rollback; kiểm tra linkage/object/ownership sau restore.

Một file dump tồn tại không chứng minh có thể phục hồi. Không báo một RPO/RTO chung khi chưa chạy drill với snapshot đó. Redis cache, SMTP delivery và provider-side effects có recovery semantics khác SQL.

## Release và rollback

Trước deploy cần frozen exact source, targeted checks, independent review, image/config provenance và môi trường backup/rollback phù hợp. [CI](../.github/workflows/ci.yml), [image publishing](../.github/workflows/publish-images.yml), [runtime compose](../.github/workflows/runtime-compose.yml) là các owners khác nhau.

Rollback image không tự đảo migration hoặc xóa effect đã được gửi ra SMTP/bank/provider. Với schema thay đổi, xác nhận compatibility của ứng dụng cũ và dữ liệu mới trước chọn digest cũ. Không giảm security/provider gates để vượt một health failure.

Không suy ra cloud live state từ manifest. Tài liệu này không yêu cầu tự publish hoặc merge; các thao tác đó cần authority đúng session/release.

## Checklist ghi bằng chứng

- Source SHA, image identity và environment.
- Operation/command, phạm vi data/role và kết quả quan sát.
- Gate chưa chạy, dependency thiếu hoặc mismatch.
- Recovery target và snapshot nếu thao tác dữ liệu.
- Logs/screenshots đã redact, không có credential hoặc dữ liệu thật.
