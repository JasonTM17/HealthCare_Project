# Kiểm thử và cách đọc chất lượng

[Tài liệu](README.md) · [Contributing](contributing.md) · [Operations](operations.md)

## Chọn gate theo thay đổi

| Thay đổi | Checkpoint phù hợp |
| --- | --- |
| Documentation/media | Paths/anchors/assets, render, source claims, scoped diff và independent review |
| UI hoặc BFF | Focused static/contract tests, type/lint, rendered test và browser thật |
| Core nghiệp vụ | Focused Java regression và PostgreSQL integration cho boundary bị ảnh hưởng |
| AI | Python tests và Java gateway/policy tests; provider thật chỉ khi gate yêu cầu |
| Schema | Clean-chain, upgrade path, invariant/constraint và data rehearsal |
| Infra/deploy | Manifest tests, service health, exact image/source provenance, live acceptance |

Không chạy suite lớn sau mọi sửa câu chữ; cũng không dùng static green thay cho browser, PostgreSQL, provider hay recovery evidence.

## Frontend

Chạy trong `apps/frontend`; [package.json](../apps/frontend/package.json) sở hữu commands:

```powershell
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:rendered
npm run build
```

`npm run verify` gom lint/typecheck/test/build, **không** tự bao gồm mọi rendered/E2E gate. Browser suites có `test:e2e` và `test:e2e:compose`; xem [Playwright compose config](../apps/frontend/playwright.compose.config.ts), [E2E tests](../apps/frontend/tests/e2e) và [rendered test guide](frontend-rendered-tests.md).

E2E có thể tạo lịch, sửa nội dung hoặc đối soát fixture. Đọc guard/env/test data ownership trước khi chạy; không trỏ suite dùng mutation vào website production chỉ vì cùng route. Screenshot tour đọc dữ liệu khác lifecycle E2E.

## Backend

JDK 21, Maven wrapper và dependency phù hợp. Trước suite dùng PostgreSQL/MinIO/Testcontainers, chạy preflight từ repo root:

```powershell
.\scripts\check-backend-test-preflight.ps1
```

Sau khi môi trường test sẵn sàng, chạy trong `apps/backend`:

```powershell
.\mvnw.cmd -B verify
```

[Backend README](../apps/backend/README.md), [pom.xml](../apps/backend/pom.xml) và [CI workflow](../.github/workflows/ci.yml) sở hữu setup. Biến `TEST_DB_*` và cleanup authority phải chỉ đúng database test; không dùng demo/production DB làm target mặc định.

| Boundary | Điểm vào regression |
| --- | --- |
| Booking và slot | [AppointmentBookingIntegrationTest](../apps/backend/src/test/java/com/healthcare/appointment/AppointmentBookingIntegrationTest.java) |
| Browser auth | [BrowserSessionSecurityIntegrationTest](../apps/backend/src/test/java/com/healthcare/auth/BrowserSessionSecurityIntegrationTest.java) |
| Payment state | [BankTransferPaymentStateMachineTest](../apps/backend/src/test/java/com/healthcare/payment/BankTransferPaymentStateMachineTest.java) |
| Conversation/consent/cancel/credit | [AI tests](../apps/backend/src/test/java/com/healthcare/ai) |
| Storage/scan | [Storage tests](../apps/backend/src/test/java/com/healthcare/storage), [consultation tests](../apps/backend/src/test/java/com/healthcare/consultation) |

## AI service

Trong Python environment của `apps/ai-service` đã cài [requirements](../apps/ai-service/requirements.txt):

```powershell
python -m pytest
python -m ruff check .
python -m mypy
```

[pyproject.toml](../apps/ai-service/pyproject.toml) sở hữu discovery/typecheck config; [tests](../apps/ai-service/tests) có config/provider, RAG, source, safety và operational contracts. Mock provider tests không chứng minh authenticated provider call hoặc durable adapter của hosted môi trường.

## Infrastructure và CI

[ci.yml](../.github/workflows/ci.yml) chia gate frontend/backend/AI/infrastructure/database/hygiene; [runtime-compose.yml](../.github/workflows/runtime-compose.yml) là gate runtime riêng. [Infrastructure tests](../infrastructure/tests) kiểm tra manifest contracts. Docker config thành công chỉ chứng minh cấu hình resolve, không chứng minh service boot và browser acceptance.

CI badge là liên kết tới workflow. Khi báo CI PASS cần run URL và exact SHA. Workflow YAML trong repo không chứng minh run đã xảy ra.

## Báo cáo evidence

Mỗi gate ghi command, cwd, snapshot, environment và result. Dùng `PASS`, `FAIL`, `BLOCKED_CAPABILITY`, `NOT_RUN`; lỗi missing Docker/provider credentials phải giữ đúng boundary, không đổi thành pass hoặc lỗi code khi chưa có evidence.

Bug regression cần fail trên hành vi cũ/pass trên mới; concurrency cần deterministic schedule; ownership cần negative actor. Giới hạn rerun theo plan, chỉ broadening khi sửa contract/risk hoặc quan sát failure mới.

Với media của bộ docs này, [provenance](assets/repo-tours/provenance.json) ghi snapshot và kiểm tra capture. Báo cáo workflow theo phiên nằm trong `plans/` local, được Git bỏ qua; không phải kết quả full product test.
