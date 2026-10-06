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
