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

---

## W7 — Production PDF storage restored (Supabase REST adapter) — LIVE VERIFIED

### Incident chain (for the record)

1. Supabase S3-compatible storage requires session-token auth — added
   `STORAGE_SESSION_TOKEN` support to `MinioConfig` (`StaticProvider` 3-arg)
   and deployed digest `6c68b593`.
2. Deploys then failed: **MinIO `endpoint()` rejects URLs with a path** —
   `java.lang.IllegalArgumentException: no path allowed in endpoint
   https://<ref>.storage.supabase.co/storage/v1/s3`. The `/storage/v1/s3`
   segment is mandatory on Supabase (host-only endpoint returns 404), so the
   S3-compatible path cannot reach Supabase Storage at all.
3. Env-var audit during the incident revealed the true crash-loop source:
   the wiped deploy's stale env snapshot (JWT_SECRET <32 bytes); the restored
   env list (58 vars, JWT 96 chars) was verified via API before redeploy.
4. Backend restored to live (`dep-db2ho717lnhs73f0icpg`) with sentinel
   storage creds (fail-closed, honest `generationConfigured=false`).

### Fix shipped

- `SupabaseRestDocumentObjectStore` — Supabase Storage REST adapter
  (`service-role` JWT as `apikey` + Bearer, private bucket, no presigns),
  selected by `storage.backend=supabase`; `minio` stays default for
  local/self-hosted (commit `6d45082`, image `2bc95c64`).
- `STORAGE_BACKEND=supabase` declared in `render.yaml` / `render-free-beta.yaml`
  + contract test pin (8/8 pass) + `deployment-beta.md` env table.
- Render envs: `STORAGE_BACKEND=supabase`,
  `STORAGE_ENDPOINT=https://awaknzhadjglbfkhigck.supabase.co`,
  `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` = service-role JWT (secret,
  not committed).
- Deploy `dep-db2i2qjlthtc73ak4kpg` live on image `2bc95c64`.

### Direct Supabase REST contract proof (pre-deploy)

- `POST /storage/v1/object/healthcare-files/documents/qa-probe.bin` → 200
- `GET` → 200, exact bytes returned; `DELETE` → 200 (probe object removed).

### Live production evidence (2026-10-06, via BFF browser-session)

| Check | Result |
|---|---|
| `GET /patients/{id}/documents/capabilities` | `generationConfigured=true` |
| Generate `VISIT_SUMMARY` (idempotent retry of FAILED `f0df2c52`) | `AVAILABLE`, sha256 `779edbe3…`, 660,670 B |
| Generate `PRESCRIPTION` (fresh `50c51e2f`) | `AVAILABLE`, sha256 `a90d6c9d…`, 660,272 B |
| Download `f0df2c52` | **200**, `%PDF-1.6`, 660,670 B, sha256 matches API metadata exactly |
| Download `50c51e2f` | **200**, `%PDF-1.6`, 660,272 B, sha256 matches |
| Anonymous download | **401** |
| Doctor without clinical relationship | **403** |
| Treating doctor | **200** (per `ensureDoctorCanAccessPatient`) |

**PDF on production: PASS** — the original user complaint ("PDF tải không
được") is resolved end-to-end: generation → private Supabase bucket →
authorized backend download → verified bytes/hash.

### Updated NOT_RUN register

| Item | Status |
|---|---|
| PDF generation + byte/hash download on prod | **PASS** (this section) |
| User upload lane (consultation attachments) | **BLOCKED_CAPABILITY** — unchanged (`STORAGE_UPLOAD_ENABLED=false`) |
| Remaining pre-incident FAILED documents | retryable via UI/generate API; `f0df2c52` already recovered |
