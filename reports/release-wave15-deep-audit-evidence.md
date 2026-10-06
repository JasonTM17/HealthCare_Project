# Wave-15 — Production deep-audit round 2 + document lifecycle deployment

Frozen snapshot under review: `7425362` (tip) — backend image pending publish.
Prior live image: `2bc95c64` (from `6d45082`, Supabase REST document store).

## W15-3 — Deep-audit round 2: all findings adjudicated, zero real defects

| Probe finding | Verdict |
|---|---|
| `/dang-nhap`, `/dang-ky` 404 | **Probe artifact** — real routes are `/auth/login` + `/auth/register`; 3-role logins PASS in-browser |
| `401` on `/api/v1/public/*` (branches, specialties…) | **Probe artifact** — GET on POST-only endpoints; backend `permitAll` is POST-scoped. POST returns 200 with real sql-catalog triage. `/api/v1/hospital/*` GETs = 200 anonymous (verified) |
| `/public/ai/chat` 403 on bare curl | Browser BFF flow verified working (chat audit corpus 27/27); bare curl lacks Origin/session headers BFF requires |
| `/about` "Đang cập nhật quy mô mạng lưới…" | **SSR loading state** — client fetch of hospital counts resolves (endpoints 200); static HTML snapshot catches pre-hydration copy. Error/retry path exists |
| `admin-catalog` 452 chars in 2.5s probe | **Timing artifact** — real content = 101,092 chars + 284 `data-id` sortable rows after client hydration (~8s incl. login) |
| `/patient/appointments` 56-char body | **By design** — server-side `redirect("/patient/dashboard#appointments")` |
| 4× console 401s | Expected pre-auth `/users/me`-class probes during anonymous load |
| Articles aborted RSC requests | Next.js framework navigation noise (filtered) |

## Mobile audit (390px viewport, 8 public routes)

- Horizontal overflow: **0/8 routes** (`/`, `/branches`, `/doctors`, `/specialties`, `/articles`, `/faq`, `/about`, `/auth/login`)
- "Broken images" initial pass = lazy-loading placeholders; **0 still-incomplete after full scroll** on homepage desktop probe

## Authenticated journeys (Playwright, real prod)

- Patient login → dashboard, prescriptions, documents page (honest empty state before storage fix)
- Admin login → catalog (101K real content, SortableJS handles), FAQ rows
- Doctor login → articles
- **9/10 PASS; 1 FAIL = catalog timing artifact above**

## Chatbot routing (prod corpus, warm)

- Crisis → `EMERGENCY`/`public_safety_guardrail` 0.29–1.74s
- Booking shortcut → `public_support_shortcut` ~0.3s
- Catalog/amenity deterministic → `public_catalog_fallback`/`public_amenity_fallback` ~0.6s
- Provider-backed LLM → `remote_llm_escalation` 3.7–11.6s (DeepSeek remote; degraded fallback honest when slow)

## W15-4 — Service posture audit

| Check | Result |
|---|---|
| Frontend `www.healthcare.id.vn` | 200 |
| Backend `/actuator/health` | 200 |
| AI `/livez` | 200 |
| Vercel prod deployment | `7425362` READY (tip) |
| Render env vars | 59 — full storage set present (`STORAGE_BACKEND/ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY/SESSION_TOKEN` + flags) |
| Live backend image vs render.yaml pin | `2bc95c64` — **match, no drift** |
| Live image vs wave-15 fixes | **STALE** — `7425362` doc-lifecycle fixes not in image → publish `37504397147` dispatched |

## Wave-15 document lifecycle fixes to deploy (commit 7425362)

- PENDING-row adoption on idempotency-key collision
- `DataIntegrityViolationException` → deterministic 409 propagation via global handler
- `findFirstByPatientId…StatusOrderByGeneratedAtDesc` + status-in variants for failed/stale reuse
- Audit side-pool isolation for generation locking
- `DocumentServiceTest` 34/34 green

## NOT_RUN / residual register

- Upload lane (`STORAGE_UPLOAD_ENABLED=false`, needs ClamAV worker) — BLOCKED_CAPABILITY
- Bank-transfer payment E2E — BLOCKED_CAPABILITY (beta posture)
- Email/OTP delivery — BLOCKED_CAPABILITY
- Provider LLM latency 4–11s under remote escalation — inherent, documented degraded path

## Deployment of wave-15 fixes — COMPLETED

| Step | Evidence |
|---|---|
| CI `7425362` | `37501899213` → **success** after rerun (frontend job flake = PowerShell `FileLoadException` runner issue, unrelated to backend doc changes) |
| Image publish | `37504397147` → backend manifest `sha256:ca701f1afa6844c8bd9246ab8fcb45dea596d4f421beb4faee6b4f07f87032e6` |
| Pin sync | `render.yaml`, `render-free-beta.yaml`, contract test — `50ad029` pushed |
| Render image update | API quirk: PATCH body needs top-level `{"image":{ownerId,imagePath}}` — `serviceDetails.image` is silently ignored |
| Deploy | `dep-db2j80q6f5ic73d1i2s0` → **live**, `/actuator/health` 200 |

## Live verification on deployed image (BFF session, real bytes)

- `capabilities` → `generationConfigured: true`
- `patients/…/documents` → **4/4 AVAILABLE** (2 PRESCRIPTION + 2 VISIT_SUMMARY)
- Download `50c51e2f` → **200, `application/pdf`, `%PDF-1.6`, 660,272B**
- **sha256 `a90d6c9d…d0d` — byte-exact match** with document metadata

## Specialist review round 2 — adjudication + hardening applied (commit `4962565`)

| Finding | Severity | Disposition |
|---|---|---|
| afterCommit `resolveCandidate` unguarded → committed success could surface 500 | Med-Low | **FIXED** — `resolveCleanupQuietly` wraps both paths; worker reconcile self-heals |
| Direct `auditService.record` on 15 primary allow/deny sites → audit outage masks outcome as 500 | Medium | **FIXED** — all sites now `recordAuditSafely` (fail-soft per documented invariant) |
| Booking slot advisory lock unbounded wait → same pool-starvation shape as confirmed doc regression | Medium | **FIXED** — `SET LOCAL lock_timeout='5s'` in `PostgresAppointmentSlotLocker`; `PessimisticLockingFailureException` → 409 via GlobalExceptionHandler |
| Cleanup claim→delete TOCTOU — reference checked only at claim | Low | **FIXED** — re-check `EXISTS patient_documents` immediately before delete; newly-referenced key resolves marker instead |
| FAILED-row references hide orphan objects from cleaner | Low | Documented accepted-risk — retry overwrites same key; periodic sweep deferred |
| Env-only MinIO creds → `isConfigured=false` under-report | Info | Fail-closed, ops note only |
| Review snapshot drift | — | Reviews were run against older frozen packets; all findings re-verified against current source before fixing |

Tests after fixes: `DocumentServiceTest` 34/34, `DocumentObjectCleanupServiceTest` 4/4 (new TOCTOU regression pin), booking/appointment suite batch 174/174.

## Hardening round-2 deployment — COMPLETED

| Step | Evidence |
|---|---|
| CI `4962565` + `42e9a83` | success (`37513668477`, `37513697998`) |
| Publish | `37516305087` — backend `sha256:33f9956c4b7591d8ab2c616d77b355f090f4533d5c04a199e1373101233c776d` from `42e9a83` |
| Pin | `9e91f56` — render.yaml + mirror + contract test (8/8) |
| Deploy | `dep-db2kfch42hec738r8qr0` → **live**, health 200 |
| Live verify (new image) | login 200 · `generationConfigured:true` · 4/4 AVAILABLE · download sha256 **byte-exact** |
