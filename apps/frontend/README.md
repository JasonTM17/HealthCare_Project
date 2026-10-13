# Frontend HealthCare

[Repo overview](../../README.md) · [Documentation hub](../../docs/README.md) · [Getting started](../../docs/getting-started.md)

## Runtime và commands

Next.js/React/TypeScript frontend. [package.json](package.json) sở hữu engines và scripts; [package-lock.json](package-lock.json) sở hữu resolved versions. Dùng npm ci để cài theo lockfile, không dùng số phiên bản hoặc kết quả audit của một deployment cũ làm hợp đồng hiện tại.

Chạy từ apps/frontend:

~~~powershell
npm ci
npm run dev
npm run verify
npm run test:rendered
npm run test:e2e
~~~

verify gồm lint/typecheck/Node tests/build. Rendered/E2E chạy riêng khi boundary cần. [Testing guide](../../docs/testing.md) và [compose Playwright config](playwright.compose.config.ts) giải thích live fixture và mutation scope.

## Source navigation

| Boundary | Owner |
| --- | --- |
| Pages/portals | [app](app), [components](components) |
| Same-origin API | [api-client.ts](lib/api-client.ts) → [healthcare-bff.ts](lib/server/healthcare-bff.ts) |
| Browser identity | [useAuthSession](components/useAuthSession.ts), auth contracts in backend |
| CMS editor/preview | [CMS README](components/cms/README.md), [CMS realtime](../../docs/architecture/cms-realtime.md) |
| Clinical/patient screens | [patient routes](app/patient), [doctor routes](app/doctor) |
| Assistant UI | [AssistantProvider](components/AssistantProvider.tsx), [patient chat](app/patient/chat/page.tsx) |
| Rich text | [TinyMCE integration](../../docs/tinymce-integration.md), [editor components](components/editor) |

## BFF configuration

Browser chỉ gọi same-origin BFF. BACKEND_INTERNAL_URL, BFF_PUBLIC_ORIGIN và BACKEND_BFF_SERVICE_TOKEN là server-only; không chuyển chúng thành NEXT_PUBLIC keys. Cookie opaque browser session, CSRF, reserved headers, deadlines/retry và private chat paths do BFF/Core sở hữu; [API/Auth guide](../../docs/api-reference.md) dẫn đến executable contracts.

Demo-login controls là build-time configuration; đổi environment sau build không tự cập nhật UI. [Local demo runbook](../../docs/local-demo-runbook.md) sở hữu các cờ demo.

## Build và hosted evidence

[vercel.json](vercel.json) sở hữu install/build contract; hosted FE dùng project root apps/frontend. [Deployment notes](../../docs/deployment.md) và [Operations](../../docs/operations.md) sở hữu quy trình release.

Một build local thành công không chứng minh Vercel đã triển khai cùng SHA. Không giữ deployment ID, catalog counts, dependency audit result hoặc latency snapshot cũ trong hợp đồng setup này; evidence theo phiên nằm ở plans/reports.

## Design và thư viện

Nhận diện/nội dung HealthCare là của dự án; site tham khảo chỉ định hướng information architecture. Rich-text editor dùng assets self-hosted và renderer chung; không tự thêm provider/cloud key để sửa một plugin path. Giấy phép repo không thay giấy phép dependency; kiểm tra tài liệu/license của thư viện khi phân phối.

Đọc [hướng dẫn đóng góp](../../docs/contributing.md) trước khi sửa frontend.
