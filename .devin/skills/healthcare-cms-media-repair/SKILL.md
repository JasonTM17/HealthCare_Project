---
name: healthcare-cms-media-repair
description: Bounded implementation of confirmed CMS/media public-render defects: imageUrl validator aligned to CSP, hideOnError only hides 404, BFF media cache, IMAGE_CARD fallback, pre-line body.
agent: subagent_general
---

You are a bounded implementer with EXCLUSIVE write ownership of these files ONLY:
- apps/backend/src/main/java/com/healthcare/cms/service/CmsPayloadValidator.java
- apps/backend/src/test/java/com/healthcare/cms/ (ONLY files you create or that already target CmsPayloadValidator — find the existing validator test class if present; do not touch other backend tests)
- apps/frontend/lib/cms-client.ts
- apps/frontend/lib/healthcare-bff.ts
- apps/frontend/components/cms/CmsRenderer.tsx
- apps/frontend/components/cms/CmsLiveSlot.tsx
- apps/frontend/components/cms/CmsImageField.tsx
- apps/frontend/components/cms/ (its CSS module file if one exists for cms-renderer styles; find it via glob first)
- apps/frontend/tests/cms-inline-editor.test.mjs
- apps/frontend/tests/cms-realtime.test.mjs
- ONE new frontend test file if needed: apps/frontend/tests/cms-media-rules.test.mjs

Other workers own the article editor (RichTextEditor/RichContentRenderer/article pages), payment service, AI service, app/page.tsx, and e2e harness files. Do not touch them, api-client.ts, media-uploads.ts, next.config.ts CSP, manifests, reports, configs, lockfiles, dotenv, or servers. Preserve ALL user-owned dirty hunks and ALL existing comments. Read root + frontend + backend AGENTS.md first; follow existing style; no new deps. No staging/commits/push/deploy, no peers, no builds/servers, no live evidence claims.

Settled defects and cause-aligned fixes:

1) HIGH — imageUrl fields accept any https:// but CSP `img-src` only allows self + https://images.unsplash.com https://images.pexels.com https://img.vietqr.io → admin-saved external image silently broken on the public page.
   Fix at the WRITE boundary only (do not tighten read/render paths — existing published content must keep rendering):
   - Backend `CmsPayloadValidator`: for fields named `imageUrl` (and `src` if the schema has one), require root-relative `/...` (not `//`) OR `https://` with hostname in the CSP-consistent set {images.unsplash.com, images.pexels.com, img.vietqr.io}. Define the allowlist as a private static constant with a one-line comment naming the matching CSP sources. Other URL fields (ctaHref, href) keep the current broader https rule — external CTAs are legitimate.
   - Frontend: find the shared client-side payload validation used by CmsInlineEditor submit (in cms-client.ts) and apply the same imageUrl rule so the editor fails client-side with the same message class instead of saving something that renders broken. CmsImageField `isProbablySafeImageUrl` and its warning text must match the same rule (advisory only; backend authoritative). Keep the message in Vietnamese, e.g. "Đường dẫn ảnh phải là /… trên hệ thống hoặc HTTPS thuộc nguồn được phép (Unsplash, Pexels, VietQR)."
   - Add validator tests: relative `/media/x.jpg` PASS; `https://images.unsplash.com/a.jpg` PASS; `https://evil.example/a.jpg` REJECT; `javascript:`, `//evil.example`, `data:` REJECT. Frontend tests for the client validator mirror the same cases.

2) MEDIUM — CmsLiveSlot `hideOnError` swallows ALL errors (5xx/network/schema) making an outage indistinguishable from an unpublished slot.
   Fix: in CmsLiveSlot's error branch, treat only the not-found kind (the client's 404/not-found error class — use the existing CmsApiError.kind === "not-found" detection) as hideable; for any other error, log exactly one console.warn per slot instance per distinct error (include slotKey + status only, never payloads) and then render the provided `fallback` if one exists, else the same empty fragment. Do not render error UI on public slots. Do not change polling, SSE, the 60s contract, or error classification elsewhere.

3) MEDIUM — media bytes lose cacheability through the BFF.
   In lib/healthcare-bff.ts find where public read paths / response headers are handled; make `GET /api/v1/media/` behave like other public reads so the backend's `Cache-Control` (max-age) survives to the browser. Keep `/upload` and everything else unchanged. Only touch the minimal condition; do not widen the public allowlist beyond media GETs. Note the existing header allowlist must still apply.

4) LOW — IMAGE_CARD SafeImage has no error fallback; broken image renders a bare glyph.
   First verify CmsRenderer.tsx is only imported through client components (check its importers). If safe, convert SafeImage's broken-path to a small client-aware pattern WITHOUT adding hooks to a server-imported module: preferred minimal approach — an `onError` inline handler that hides the img and reveals a sibling `<p hidden role="alert">Hình ảnh chưa được hiển thị.</p>` via DOM mutation (setAttribute/removeAttribute), requiring no state and no "use client" addition. If the module is already client-side you may use the simplest equivalent. Do not change SafeLink.

5) LOW — CMS RICH_TEXT/NOTICE body is authored plain-text but rendered in a collapsing `<p>`.
   Locate the stylesheet for `.cms-renderer__body` (search for the class across css/scss/module files). Add `white-space: pre-line` to that rule ONLY — preserving the plain-text contract while letting admin-authored line breaks render. No schema change, no markdown rendering — RICH_TEXT stays plain text per the settled contract.

Verification (run only these):
- `node --test` on each frontend test file you touched/created, from apps/frontend
- `node node_modules/eslint/bin/eslint.js` on each edited frontend file
- Backend: `git diff` review only — do NOT run Maven/Gradle (containerized runs belong to the Team Lead; the Docker daemon is unstable)
Report exact commands + stdout. Typecheck/build/browser/live runs are the Team Lead's — mark NOT_RUN.

Return: full `git diff` per file, before/after git hash-object of each edited file, per-finding status (FIXED-VERIFIED / FIXED-PENDING-LIVE / DEFERRED + reason), and any place where source reality contradicted the assigned fix — stop and report instead of improvising. No user communication, no production, no release claims.
