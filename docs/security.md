# Ranh giới bảo mật

[Tài liệu](README.md) · [API/Auth](api-reference.md) · [AI](ai-system.md)

## Phạm vi của tài liệu

Đây là bản đồ các ranh giới và owners cần đọc, không phải chứng nhận compliance hoặc tuyên bố hệ thống không có lỗ hổng. Một test/ảnh demo không thay thế audit, provider/deployment review hoặc kiểm chứng với dữ liệu thật.

## Trust boundaries

| Ranh giới | Điều cần giữ | Owner |
| --- | --- | --- |
| Browser → BFF | Same-origin, input/header/path bounds, không lộ server trust token | [BFF](../apps/frontend/lib/server/healthcare-bff.ts) |
| BFF → Spring | Shared service authentication khác user identity | [BffRequiredFilter](../apps/backend/src/main/java/com/healthcare/auth/security/BffRequiredFilter.java), [verifier](../apps/backend/src/main/java/com/healthcare/auth/security/BffRequestVerifier.java) |
| Session → mutation | Current session + CSRF + origin | [BrowserCsrfFilter](../apps/backend/src/main/java/com/healthcare/auth/security/BrowserCsrfFilter.java) |
| Identity → clinical data | Role và linked owner/clinician | [SecurityConfig](../apps/backend/src/main/java/com/healthcare/security/SecurityConfig.java), [ClinicalService](../apps/backend/src/main/java/com/healthcare/clinical/service/ClinicalService.java) |
| Core → AI | Service token, bounded context, source policy | [AI module](../apps/backend/src/main/java/com/healthcare/ai), [FastAPI](../apps/ai-service/app) |
| Core → object store | Private objects, authorized metadata/linkage, scan gates | [Storage](../apps/backend/src/main/java/com/healthcare/storage) |
| Webhook → payment | Signature/replay handling, queue/review authority | [WebhookService](../apps/backend/src/main/java/com/healthcare/payment/service/BankTransferWebhookService.java) |
| Draft → public CMS | Only published snapshot and safe event metadata | [CMS realtime](architecture/cms-realtime.md) |

## Auth và quyền sở hữu

Browser sessions được server phát hành và lưu hash; session secret không cần trở thành JavaScript bearer. Cookie attributes, idle/absolute expiry và revocation thuộc [BrowserSessionService](../apps/backend/src/main/java/com/healthcare/auth/service/BrowserSessionService.java).

JWT vẫn có contract riêng. Password reset/change, role changes và session/token invalidation cần được đọc theo auth/security source; không chỉ kiểm tra role trên Header/UI. [BrowserSessionSecurityIntegrationTest](../apps/backend/src/test/java/com/healthcare/auth/BrowserSessionSecurityIntegrationTest.java) là một điểm vào cho negative cases.

Clinical authorization kết hợp identity và linkage. Dùng UUID khó đoán không thay owner check. Doctor role không tự cấp quyền khám hồ sơ bất kỳ; một user có thể chưa gắn doctor profile. Admin visibility trong menu cũng không tự chứng minh backend cho phép hành động.

## AI và dữ liệu

Không để model sở hữu quyền quyết định source, booking slot, doctor ID hoặc URL có quyền. Citation phải resolve từ nguồn hợp lệ; consent và source eligibility không thay ownership.

Patient history, projection và provider context là ba loại dữ liệu khác nhau. Khi mở remote provider cần xác nhận runtime/flags, phạm vi dữ liệu gửi ra, accounting và cancellation; đọc [AI system](ai-system.md) và [synthetic egress ADR](adr/ADR-004-synthetic-ai-egress.md).

Không khẳng định prompt defense loại bỏ mọi injection. Negative tests chứng minh những input đã thử; policy và provenance còn phải giữ ở đường production thật.

## Tệp đính kèm

Upload/read phải thỏa MIME/size, quyền/linkage, private storage và scan requirements theo cấu hình. Presigned URL là quyền truy cập có thời hạn; nó không tự chứng minh encryption-at-rest hoặc isolation của hosted bucket.

Nguồn: [ConsultationAttachmentStorageService](../apps/backend/src/main/java/com/healthcare/storage/service/ConsultationAttachmentStorageService.java), [scanner configuration](../apps/backend/src/main/java/com/healthcare/storage/config/AttachmentScannerConfiguration.java), [consultation workers](../apps/backend/src/main/java/com/healthcare/consultation), [Compose](../infrastructure/docker-compose.yml).

Không mở upload khi scanner unavailable chỉ để làm demo. Nếu feature bị đóng trong môi trường hosted, giữ sự phân biệt giữa “module có trong source” và “tích hợp đã được bật”.

## Secrets và evidence

- `.env`, DSN, cookies, bearer/service tokens, private keys và raw provider errors không vào Git hoặc screenshots.
- Browser trace của login/chat có thể chứa credentials/context; media capture dùng phiên riêng và không ghi hình form nhập mật khẩu.
- Dữ liệu seed và tên giả lập vẫn cần nhãn minh họa, tránh người xem hiểu là hồ sơ thật.
- RLS trên projection không thay Spring authorization cho dữ liệu SQL gốc.
- Health response, CI badge và deployment manifest không tự chứng minh live security posture.

## Negative cases cần kiểm chứng khi sửa boundary

| Thay đổi | Cases cần xem |
| --- | --- |
| Browser/BFF | Missing/wrong Origin, service authentication, CSRF mismatch, session hết hạn |
| Clinical | Patient khác owner, doctor chưa linked, object không thuộc ca |
| Booking | Concurrent hold, OTP expiry/attempts, lookup/hủy thiếu proof |
| Payment | Webhook replay/mismatch, ended appointment, reviewer authority, demo graph crossing |
| AI | Missing consent, revoked source, cancel-before-commit, ownership/credit races |
| CMS | Draft leak, preview cross-origin/source, stale public cache |
| Storage | Invalid MIME, scanner failure, forged key, unauthorized download |

[Testing](testing.md) dẫn đến executable tests và môi trường cần thiết. Không gọi gate chưa chạy là PASS.
