# Wave-14 D-Campaign — Authenticated Production Evidence

Date: 2026-10-06. Target: `https://www.healthcare.id.vn` (Vercel) + Render backend (digest `02da1580`) + AI service.
Head at audit time: `d201458` (CI: success).

## Authenticated identity

Existing seeded demo accounts were used — **no new DB writes were needed**
(Kongming's SQL-seed fallback was unnecessary; `V58__seed_healthcare_com_demo_users.sql`
already provides verified accounts on every environment):

| Role | Account | Login | Notes |
|---|---|---|---|
| ADMIN | `admin@healthcare.com` | **PASS** (200, session issued) | `is_demo=true`, `email_verified=true` |
| PATIENT | `patient@healthcare.com` | **PASS** (200) | id `…0021`/`…0022` |
| DOCTOR | `doctor@healthcare.com` | **PASS** (200) | linked doctor row `30000000-…-0001` |

## API-level probes (session cookie, real BFF)

| Endpoint | Result |
|---|---|
| `admin/faqs`, `admin/packages`, `admin/articles`, `admin/appointments`, `admin/doctors`, `admin/cms/content` | **200** each — real paged data |
| `admin/payments` | **200** (status enum validated: unknown status → 400, correct) |
| `patient/overview` / `prescriptions` / `care-plans` / `appointments` / `profile` | **200** — real data (11 appts, 4 rx, 6 CLS, 8 notifs, 93 AI credits) |
| `notifications` | **200** |
| `doctor/profile` / `articles` / `consultations` | **200** |
| `patients/{id}/documents` | **200 — all 3 documents `status=FAILED`** (see root-cause below) |
| `patients/{id}/documents/capabilities` | **200 — `generationConfigured=false`** |

## Browser journeys (Playwright, 1440px)

- 17/17 authenticated routes render, 0 page errors (patient 7, admin 6, doctor 4).
- `/patient/appointments|prescriptions|medical-records` → intentional compatibility
  redirects to `/patient/dashboard#…` anchors — **by design**, not defects.
- `/admin/catalog`: 100k chars of real catalog content, **570 SortableJS handles**
  (drag handles + ▲/▼ accessible fallbacks present).
- `/admin/catalog` article edit → **TinyMCE loads on prod** (`.tox-tinymce` present).
- `/patient/documents` renders honest empty state: "PDF sẵn sàng 0", beta/no-digital-signature
  disclaimer — truthful UX, no mock buttons claiming success.
- Console errors: only expected pre-auth 401 prefetch noise (known, cosmetic).

## Root cause — production PDF/documents (`BLOCKED_CAPABILITY`)

Original complaint "chức năng PDF tải không được" traced end-to-end:

1. `GET /patients/{id}/documents/capabilities` → `generationConfigured=false`.
2. `DocumentService.capabilities` = `MinioDocumentObjectStore.isConfigured()` =
   requires real `storage.access-key` + `storage.secret-key`.
3. `render.yaml` had **no** `STORAGE_ENDPOINT/ACCESS_KEY/SECRET_KEY` → blank
   credentials fail closed by design (`isRealCredential` rejects placeholder/blank).
4. Consequence: all 3 seeded documents stuck at `status=FAILED`, `sha256=null`,
   `byteSize=null`; generation endpoint returns 503; downloads fail closed.

### Repair applied this wave (commit `d201458`)

- **Supabase**: created private bucket `healthcare-files` (`public=false`) —
  the only piece achievable without dashboard secrets.
- **render.yaml + render-free-beta.yaml**: declared `STORAGE_ENDPOINT`,
  `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` as `sync:false` dashboard secrets;
  `STORAGE_REGION=ap-northeast-1`, `STORAGE_BUCKET=healthcare-files` as posture.
  `STORAGE_UPLOAD_ENABLED` stays `false` (generation uses the server-side client).
- **Contract test** updated to pin the new secret keys (`sync:false`) + posture;
  8/8 pass. `docs/deployment-beta.md` flag table now documents the dependency.

### Remaining manual step (USER — one-time, ~2 min)

Supabase Dashboard → Storage → S3 Access Keys → "New access key", then set in
Render dashboard for `healthcare-beta-backend`:
- `STORAGE_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3`
- `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` = minted pair

After redeploy, `generationConfigured` → `true`; regenerate the 3 FAILED
documents via `POST /patients/{id}/documents` and re-verify download bytes.

## NOT_RUN register

| Item | Status | Reason |
|---|---|---|
| PDF generation + byte/hash download on prod | **BLOCKED_CAPABILITY** | storage secrets pending (manual step above) |
| User upload lane (consultation attachments) | **BLOCKED_CAPABILITY** | `STORAGE_UPLOAD_ENABLED=false` by beta design; needs ClamAV worker |
| Bank-transfer payment decision | **BLOCKED_CAPABILITY** | `APP_PAYMENT_BANK_TRANSFER_ENABLED=false` by beta design; needs real bank account |
| Email/OTP journeys | **BLOCKED_CAPABILITY** | `APP_MAIL_ENABLED=false`; demo OTP test-only |
| TinyMCE write+publish on prod | **NOT_RUN** | avoided mutating public content; editor loads verified; save path proven on local-compose E2E (3/3) |
| SortableJS drag on prod | **NOT_RUN** | read-only probes only; runtime proven on local-compose E2E |
| Cross-browser (Safari/Firefox) prod sweep | **NOT_RUN** | Chromium-only this wave |

## Specialist re-review

- `healthcare-final-review` (independent, read-only): **CONDITIONAL PASS** on the
  frozen audit spec; residual F-2 (download revalidation/close) confirmed closed
  since wave-4; recommends acceptance against current head — satisfied by the
  fresh live-compose E2E (3/3 on `52c6ee4`) + this D-campaign evidence.
- No new blocking findings. Documented residuals unchanged: deterministic-lane
  output-scan gap (F-9, monitor), side-effect pool quota review (F-6),
  capability-posture ≠ reachability (F-5).
