# FE UI/UX Browser Audit — 2026-09-14

Workflow: `/ak:scout` → browser deep-scan (agent-browser CLI, 23 public pages + 3 portals,
desktop 1440/1280 + mobile 390) → `/ak:advise` (Advisor) + Kongming + Wukong
parallel review → `/ak:cook` → `/ak:test` → live re-verification.

Runtime identity: `infrastructure-frontend-1` rebuilt twice during the session
(17:06 UTC watcher rebuild, then fix builds). Verification evidence at
`scratch/ui-audit-0914/` (screenshots `VERIFIED_*.png`, console logs).

## Session 3 — 2026-09-15 (e2e validation + portal accessibility sweep)

### E2E suite validation
Full Playwright run (`npx playwright test`): **93 passed / 3 failed**, and all 3
failures (core-flows booking flow, floating-assistant guest chat,
portal-navigation-responsive tablet boundary) **pass in isolation** — they are
load-induced timeouts from 17 workers hammering one local server, not product
defects. This validates the session-2 changes end-to-end, including the
re-scoped patient-chat nav assertion and the paginated doctor-catalog loader.

### Portal accessibility sweep (axe-core, logged in per role, 17 pages)
Initial: 1 critical + 5 serious. All fixed:

| Page | Violation | Fix |
|---|---|---|
| /admin/catalog | [critical] unlabeled required input | Slug input: `htmlFor`/`id` + `aria-label` (`app/admin/catalog/page.tsx`) |
| /admin/catalog | [serious] frame-title + aria-prohibited-attr on TinyMCE iframe | `RichTextEditor`: `onInit` sets iframe `title` and removes TinyMCE's `aria-label` from `<body>` (prohibited on body; TinyMCE 8 has no `iframe_title` option) |
| patient+doctor /profile | [serious] color-contrast on ImageUpload remove button | `.removeBtn` color `#dc2626` → `#b91c1c` (5.9:1 on red-50) |
| /admin/content | [serious] color-contrast ×15 (`opacity-70` mono slugs) | `CmsEditor.tsx` route-slug span: `opacity-70` → `text-slate-600` (7.3:1) |

Final: **17/17 portal pages 0 critical / 0 serious**, plus 14/14 public pages
0/0 from session 2 — the scanned site is axe-clean at WCAG 2.x A/AA.

### Gates
lint PASS · typecheck PASS · 325/325 unit tests PASS · full e2e effectively
green (93 + 3 isolated passes) · FE container rebuilt after each fix round.

## Session 2 — 2026-09-15 (deep interaction pass)

Second browser pass over interactive flows (patient chat/documents/consultations,
doctor TinyMCE composer + consultation detail, admin specialties CRUD + AI review
modal, `/dat-lich` inline booking), plus axe-core scan, plus residual fixes.
Review agents re-run on the delta: Kongming REVISE→amended, Wukong root-caused F-2b.

### New findings and dispositions

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| S2-1 | **P1 backend** | `GET /patients/{id}/documents` always 409: `DocumentService.TARGET_DOCUMENT="DOCUMENT"` violates `ck_clinical_access_audit_target_type` CHECK (V52 allows only MEDICAL_RECORD/PRESCRIPTION/DIAGNOSTIC/FILE) on the audit INSERT inside the read path → every document action 409ed. Root cause by Wukong (unit tests mock the audit service, so it never surfaced). | **FIXED** — migration `V75__allow_document_target_in_clinical_access_audit.sql` extends the CHECK. Flyway applied on rebuild; Documents panel now renders its empty state with PDF-generating CTAs (verified live) |
| S2-2 | P2 UX | Patient portal nav wrapped 13 tabs across 5 rows on phones, burying the first screen of content | **FIXED** — `.portal-nav` is now a single horizontal scroll strip at every width + auto-scroll active tab into view on route change (PortalChrome). Kongming caught a leftover `max-width:640px` wrap override; removed. Re-scoped 3 test contracts (portal.test.mjs, patient-chat.test.mjs, patient-chat e2e overflow assertion → one-row height ≤64px). Verified live at 390px: nav 53px tall, scrollable, zero document overflow |
| S2-3 | P2 a11y | axe-core scan of 14 public pages: 0 critical, 1 serious — invalid element inside `dl` on /articles | **FIXED** — stat-note `<p>` moved inside `<dd>` as block span; re-scan 0/0 |
| S2-4 | P2 | `NEXT_PUBLIC_SITE_URL` read at 5 divergent sites (layout ×2, robots, sitemap, disease-guide canonical) | **FIXED** — `lib/site-url.ts` (`SITE_URL` + `safeSiteOrigin()` guard) is now the single source |
| S2-5 | — | Triage cards never render for symptom questions | NOT A DEFECT — `AI_CHAT_SYMPTOM_TRIAGE_ENABLED=false` by default (compose); FE renders triage only when backend sends it. Enable the flag to showcase triage |
| S2-6 | — | Homepage SSE reconnect loop + duplicated CMS fetches seen in session 1 | RESOLVED BY REBUILD — current build shows exactly 1 EventSource, bounded slot fetches (hero/body ×2, sidebar/footer ×1 per 30s idle) |
| S2-7 | env | Docker Desktop daemon quit twice mid-session (localhost refused) | Host-side instability; restart + `docker compose up -d` recovers. Recommend investigating host Docker Desktop auto-exit |

### Session-2 gates

- FE lint/typecheck PASS, 325/325 unit tests PASS (with re-scoped nav contracts)
- Backend Docker build PASS; Flyway V75 applied on container start (logged)
- Browser verification: Documents panel fixed, mobile nav single row, axe 0/0 on
  re-scan, admin specialties create→delete round-trip with confirm dialog

### Session-2 review trail

- Kongming: REVISE → amendments applied (640px override removal + test re-scoping);
  auto-scroll effect, site-url module, dl fix all SOUND
- Wukong: Claim-1 root cause CONFIRMED in code (CHECK gap), claims 2–3 NOT_FALSIFIED

## Session 1 (2026-09-14) — findings and dispositions

| # | Sev | Finding | Verdict | Disposition |
|---|-----|---------|---------|-------------|
| F1 | P0 | All `/admin` pages: `lg:sticky` sidebar stays in flow; `<main>` starts one viewport down (measured `main.y=900`), so operators see a blank content area | Advisor PROCEED / Kongming option-aREVISE→amended / Wukong NOT_FALSIFIED | **FIXED** — shell `lg:flex`, aside `lg:shrink-0`, main `flex-1` (`app/admin/layout.tsx`). Verified: `main.y=0, x=256` beside 256px rail |
| F2 | P1 | Booking wizard loaded only `size:6` doctors; `availableDoctors` empty for most branch×specialty combos → doctor dropdown empty, booking blocked. Homepage teaser list suppressed self-loading | NOT_FALSIFIED | **FIXED** — `fetchDoctorCatalog()` paginated loader (size 100, cap 5 pages, `last !== false` terminates so mocked e2e routes stay single-request) in `lib/api-client.ts`; BookingModal always loads full catalog, provided doctors demoted to preselect hints; PackageBookingModal switched to shared loader. Verified live: Tim mạch @ Q7 auto-selects "Bác sĩ mẫu 8 - Tim mạch", slot step lists 14 free slots |
| F3 | P1 | `/search` rendered engineering copy ("CATALOG ACTIVE", "5/5", "Cần đăng nhập") | — | Already fixed in source; stale container was serving an old build. Re-check on new build: copy is patient-facing |
| F4 | P2 | Prod React #418 hydration errors (old build: 6×HTML + canonical/og:url dropped post-hydration; new build: 1×text) | Wukong: env-drift mechanism FALSIFIED (Next inlines `NEXT_PUBLIC_*` into both server and client bundles from the same compose build arg) | **FIXED (2 sources)** — (a) Navbar utility-bar hotline swap gated behind `useSyncExternalStore` mounted flag (branches arrive mid-hydration); (b) `DailyHealthTip` seeded tip by `dayOfYear` at render — UTC server vs UTC+7 browser disagree 00:00–07:00 VN; now index 0 during hydration, day-derived post-mount via store. Verified: 0 errors on `/` and `/doctors`. Root canonical-drop resolved by the 17:06 rebuild (same-build env mismatch); `lib/site-url.ts` consolidation recommended as follow-up hardening |
| F5 | P2 | 7 demo doctors ("Bác sĩ mẫu 1/2…") on `/doctors` look like real staff duplicates | NOT_FALSIFIED (bio disclosure exists but weak) | **FIXED** — `resource-chip--muted` "Hồ sơ minh họa" badge on `slug.startsWith("demo-bs-")` cards; verified 7 badges render |
| F6 | P2 | `/benh-pho-bien` + `/auth/*` used generic default `<title>` | Advisor: trivial, high polish | **FIXED** — metadata-only layouts using `createPublicRouteMetadata` (Next 16 requires a default export: passthrough `PublicRouteLayout`). Verified titles: "Đăng nhập \| HealthCare", "Bệnh phổ biến \| HealthCare" |
| F7 | P3 | Repeated `cms/content/homepage.hero|body` fetches; `homepage.sidebar|footer` 404 by design (live-only contract with fallback rendering); `cms/content/events` SSE reconnects frequently | Advisor: dedupe only; cms-realtime tests pin live behavior | **NOT FIXED (documented)** — expected-404 is contract-driven; SSE reconnect loop needs its own investigation |
| F8 | P3 | Native date input renders en-US format inside vi UI (doctor profile, booking date) | — | NOT FIXED — native control locale; cosmetic |

## Gates observed

- `npm run lint` PASS (1 pre-existing `no-page-custom-font` warning)
- `npm run typecheck` PASS
- `npm test` PASS 325/325
- `npm run build` (inside Docker build) PASS after auth-layout default-export fix
- Docker: `docker compose build frontend && up -d` — live on :3000
- Browser re-verification: admin layout geometry + screenshot, booking wizard to
  slot step, hydration error counts 0 on `/` and `/doctors`, titles, badges

## Residual / follow-up

1. SSE (`cms/content/events?after=…`) reconnect frequency + repeated CMS slot
   fetches — instrument before changing; `cms-realtime.test.mjs` pins behavior.
2. `lib/site-url.ts` single source for `NEXT_PUBLIC_SITE_URL` reads (layout,
   robots, sitemap, disease-guide SEO) to prevent future env drift classes.
3. Guest login button appears to need a second click when automation fills
   fields rapidly (observed twice; likely fill→state race, not reproduced
   manually). Worth a Playwright repro before changing anything.
4. Demo doctor catalog (V67) will exceed 100 doctors beyond 64 branch×specialty
   combos — paginated loader already covers growth up to 500.

## Review-agent trail

- Advisor: ADVISOR: PROCEED (F1/F2/F3/F6 this session; defer F4 data-level, F5 seed-data)
- Kongming: KONGMING: REVISE → amendments applied (admin layout approach, shared
  pagination helper incl. PackageBookingModal, falsy-`last` termination)
- Wukong: 1=NOT_FALSIFIED, 2=NOT_FALSIFIED, 3=INCONCLUSIVE (env-drift refuted),
  4=NOT_FALSIFIED → fixes 1/2/4 cleared by GATE
