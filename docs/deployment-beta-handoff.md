# Production Deployment Handoff — 2026-09-13

## Update 2026-09-14 (chatbot accuracy session)

- Frontend (Vercel): redeployed from `d95cad6` — verified serving the fixed
  bundle (booking-CTA UUID pattern + unified copy). The chatbot no longer
  shows the false "chưa đạt yêu cầu an toàn" banner.
- Chatbot accuracy pipeline (local, fully verified): ai-service now has a
  lexical retrieval-rescue pass (Vietnamese symptom→specialty expansions +
  diacritic-folded token overlap) so grounded, citation-backed answers open
  without a remote embedding provider; the CTA pattern that rejected demo
  catalog UUIDs (and thereby threw AI_RESPONSE_INVALID on every grounded
  answer) is fixed. End-to-end UI check passes: "mất ngủ 3 tuần" answers with
  the Thần kinh source, citations and booking CTA.
- Backend (Render): currently `x-render-routing: no-deploy` again as of this
  session's final probe — the free instance lost its deployment.
- CI published fresh, attested images for the owner to deploy:
  - backend `sha256:ef407dcdbbc2917606b7c83fb989a29347e4d3262b31817e2d5871cd23dfe5a1`
  - ai-service `sha256:c77c38cdd72ef59c20c01b25357a2f8dedb851bff1073f187e74dacb85b38640`
    (includes the lexical rescue; required for grounded answers in production).
- Owner action (unchanged): Render dashboard → deploy the two digests above
  for `healthcare-beta-backend` and `healthcare-beta-ai`, then re-probe
  `/actuator/health` (free-tier wake can take ~120s).

## Current production state

| Layer | URL | Status |
| --- | --- | --- |
| Frontend (Vercel) | https://www.healthcare.id.vn | ✅ **Redeployed today** from `main` (b0bd5f6) — build 44s, Ready |
| Backend (Render Free) | https://healthcare-beta-backend-4wb7.onrender.com | ✅ **UP** (deployed by owner 2026-09-14; /actuator/health 200 UP) |
| AI service (Render Free) | https://healthcare-beta-ai.onrender.com | ⚠️ Owned by the same external Render account — verify together |
| Database (Supabase) | awaknzhadjglbfkhigck (Tokyo) | ✅ Alive (keep-alive workflow green, 6h cadence) |

The frontend is correct and current; every data surface it renders (CMS content,
catalogs, booking, login) shows the designed graceful fallback while the
backend is unreachable. Login attempts return a friendly inline error — no
crash, no raw stack trace.

## What was completed this session

- Landed the pending workstream (consultation guard fixes, V74 trigger-safe
  repair, articles editorial UI, e2e mock hardening) — commits `d0c2e5a`,
  `b0bd5f6`.
- Fixed a new ESLint `react-hooks/set-state-in-effect` error in
  `app/patient/chat/page.tsx` (deferred kickoff, hidden-tab safe).
- Updated source-contract tests to the refactored markup
  (`portal-accessibility-contract`, `public-routes`) — assertions now match the
  new admin-nav scroll classes and the breadcrumb-based back link.
- Restored the CSS radius token (`--radius-pill`) violated by the new video-card
  chip; `flat-ui-contract` green again.
- Verified locally: backend `mvnw test` green; frontend lint + typecheck +
  319 node tests + production build green; 22 affected Playwright e2e cases
  green against a fresh build.
- Redeployed production frontend via `vercel --prod`.
- Published fresh, CI-verified images:
  - backend digest `sha256:9dceedd723ea5a685e125c3da434d227cbd4c06af9e8191312bfc206e3c39838`
    (built from `main` @ `6ad14fd`, includes V74 + consultation fixes).

## Owner actions required (2 steps, ~5 minutes)

The healthcare-beta-* Render services live on a Render account whose API key is
not available in this environment; deploys there are dashboard-only.

1. Open the Render dashboard → `healthcare-beta-backend` → **Manual Deploy →
   Deploy latest reference** and select the new image digest
   `sha256:9dceedd7…` (or re-save the image reference from
   `render.yaml` updated to this digest).
2. Repeat for `healthcare-beta-ai` if its source changed, then probe
   `https://healthcare-beta-backend-4wb7.onrender.com/actuator/health`
   (first wake may take ~120s on the free tier).

Optionally, to make this automatic next time: export a Render API key for that
account as `RENDER_API_KEY` in this environment — the deployment can then be
triggered and verified end-to-end from here.

## Resolution (2026-09-14)

The owner deployed the backend overnight. Full production E2E executed with
agent-browser against https://www.healthcare.id.vn:

- Home: 200, CMS hydration from live backend (screenshots 01, 01b)
- Booking (/dat-lich): specialty combobox populated with the live catalog
  (Tim mach ...) -- screenshot 02
- Patient portal: login OK, greets the demo patient, appointments nav -- 03
- AI tutor chat: one message sent, assistant replied, quota decremented
  exactly 84 -> 83 per spec, history persisted server-side -- 04
- Doctor portal: login OK, schedule and patient-consultation nav -- 05
- Admin portal: login OK, hospital-operations dashboard -- 06

BFF chain probe: /api/v1/hospital/specialties 200 with a JSON payload through
Vercel -> Spring -> Supabase Postgres.


## Post-deploy verification (after owner deploy)

```bash
curl -s https://healthcare-beta-backend-4wb7.onrender.com/actuator/health
# {"status":"UP",...}  (first wake up to ~120s)
curl -s "https://www.healthcare.id.vn/api/v1/hospital/specialties?page=0&size=2"
# JSON page payload instead of the current 502 passthrough
```

Then rerun the browser E2E (screenshots in
`verification_screenshots/prod-e2e-0913/`): home, `/dat-lich`, login for the
three demo portals listed in the README.

## Post-deploy verification — 2026-10-07 (commit 23455e01)

Deployed identities:

- Frontend (Vercel): `www.healthcare.id.vn` Ready, source `23455e01`.
- Backend (Render `srv-daigprh5efls73dfau00`): deploy `dep-db2vsvijnfac73882k00`
  LIVE on image `ghcr.io/jasontm17/healthcare-project-backend@sha256:6ddb1ebd71042b34eacd5f8b50b43c43916e86475c1bcbfd9b600809186b3105`.
- AI (Render `srv-daigq6vqj5pc73a284l0`): live deploy `dep-db2v78e7bikc73blki00`
  from commit `3e2f3ad4`, URL `https://healthcare-beta-ai-9mip.onrender.com`
  (`/livez` 200). The old hostname `healthcare-beta-ai.onrender.com` is dead.

Live evidence collected:

- Backend `/actuator/health` 200 UP; tokenless patient/admin/document APIs 401.
- BFF auth: `grantType=PASSWORD` required; direct-backend login without trusted
  BFF credential 401 (fail closed); no-Origin BFF call 403.
- Patient/admin/doctor UI+BFF login 200 each.
- Patient documents: `generationConfigured=true`; live generate 201 →
  `AVAILABLE`; download 200, 660,333 bytes, `%PDF-` magic, sha256
  `de767ee6b3ef7c5a38314157c878192c6213d318e475de2b140c40536533c24b` matched
  server digest exactly; doctor cross-tenant download 403.
- Public chat canary: grounded answer + citations; records-access probe REFUSE.
- Authenticated patient chat (HOSPITAL_SUPPORT): conversation created, answer
  grounded with doctor citations, quota 100→99. Clinical modes deliberately
  report `Tạm chưa khả dụng` — `enabledModes=["HOSPITAL_SUPPORT"]` per policy
  `patient-chat-v1` (server-side config, honest fail-closed UI).
- Production UI journeys (Playwright): homepage mobile+desktop no overflow,
  login → patient dashboard → documents page renders, "Tải PDF" fires a real
  download event.

Known gaps (NOT a full production-ready claim):

- ~~Doctor portal write surfaces 403~~ — **RESOLVED** by V112
  (`V112__bind_demo_doctor_login.sql`): `doctor@healthcare.local` now bound to
  an ACTIVE doctors row; live re-check after image `f495ce35` deploy:
  login 200 → `GET /doctor/articles` 200.
- ~~`GET /api/v1/me/preferences` 404~~ — **RESOLVED**: frontend now calls the
  correct `/api/v1/users/me/preferences`; live re-check 200 with full payload.
- Google sign-in (new): backend `GOOGLE` grant verifies Google ID tokens
  server-side (JWKS signature, iss, aud==`GOOGLE_CLIENT_ID`, exp,
  `email_verified=true`), links existing emails or provisions a verified
  PATIENT, and reuses secure browser-session cookies. Frontend renders
  `GoogleSignInButton` on `/auth/login` + `/auth/register` only when
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. Live checks: missing credential →
  400 `VALIDATION_ERROR`; configured-off backend → 503
  `GOOGLE_SIGN_IN_UNAVAILABLE` (fail-closed). **BLOCKED on operator action**:
  create a Google OAuth 2.0 Web client in Google Cloud Console (JS origin
  `https://www.healthcare.id.vn`), set `GOOGLE_CLIENT_ID` on Render and the
  same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel; until then the
  button stays hidden and the grant stays 503.
- Chunked stream endpoint `messages/stream` 404 → client falls back; works.
- Payment: `patient/appointments/{id}/payment` answers 503
  `SERVICE_UNAVAILABLE` ("Thanh toán chuyển khoản chưa được cấu hình") —
  bank-transfer env not configured on Render; approval roundtrip BLOCKED
  until configured.
- OTP/email live delivery, Redis rate-limit canary, and ClamAV scan not
  exercised in production.
- JDK 24 build with `--release 21`; no cross-platform matrix.

New evidence (release `d56ece95`, backend image
`sha256:f495ce350cc648f85c682289b2f408df7291db49a428327e73a786957cbb998c`,
Render deploy `dep-db31qqu0tbcc738dv5sg` live 2026-10-07T10:26Z):

- CI 6/6 green on `d56ece95` (backend 1372 tests incl. FlywayMigrationTest
  33/33 after seed fix; frontend lint+type+test+build+e2e; ai-service;
  hygiene; infrastructure; database).
- `doctor@healthcare.local` login 200 → `/doctor/articles` 200 (V112 live).
- `GET /api/v1/users/me/preferences` 200 with full preferences payload.
- Google grant negative canaries: missing credential → 400; invalid token
  against unconfigured backend → 503 `GOOGLE_SIGN_IN_UNAVAILABLE`.

## Post-deploy verification — 2026-10-07 (feedback release, commits c2a286c6 + f0dd4fce)

New feature: authenticated user feedback ("Góp ý") at `/gop-y`.

- Backend: `V113__user_feedback.sql` (user_feedback table, category/status
  CHECK constraints, owner FK CASCADE); `POST /api/v1/feedback` 201 +
  `GET /api/v1/feedback/mine` 200; identity from authenticated principal only;
  server-side cap 10 submissions / 24h / account (429 FEEDBACK_LIMIT_EXCEEDED).
- Frontend: `/gop-y` page gates the form behind settled session state;
  anonymous visitors get "Đăng nhập để gửi góp ý" with
  `/auth/login?next=%2Fgop-y`; authenticated form validates (subject required,
  message 10–2000 chars), blocks duplicate submits while pending, and lists
  the caller's last 20 submissions. Entry points: public footer + both portal
  navs; sitemap + route-matrix inventory updated (77 routes).
- Deployed identities: backend Render image
  `ghcr.io/jasontm17/healthcare-project-backend@sha256:631c90298149bbf558e1bf170924d81d155703bd402c087fd0d34583f943d594`
  (deploy `dep-db35eqrncjis73ehcf2g` live); frontend Vercel auto-deploy.
- Live evidence: anonymous `POST /feedback` 403 and `GET /feedback/mine` 401;
  authenticated submit 201 with `createdAt` populated; invalid body (message
  <10 chars) 400; `/mine` returns the caller's rows newest-first; Vietnamese
  UTF-8 persists byte-correct; browser E2E PASS — anonymous gate renders, UI
  submit shows success banner and prepends the new item (no console errors).
- Note: three patient demo rows ("Góp ý kiểm thử production" et al.) are
  seeded test submissions under `patient@healthcare.com` — safe to triage/delete.

## Post-deploy verification — 2026-10-08 (Google/auth release)

Application source: `f78215e38ce34bac8cbb3fd5c7b68c1c62a5b16e` (includes Google subject binding and the autofill/password fixes).

- CI run `37713239493`: all six required jobs PASS. Image publication run `37713906749`: PASS; immutable registry digests verified.
- Backend: `ghcr.io/jasontm17/healthcare-project-backend@sha256:6775ddd62c1296ef0a50068a1bbfd330bc795077a5406125072c86e538c01dde`, Render deploy `dep-db3fhfl9fdbs73dini80` LIVE, health UP.
- AI: `ghcr.io/jasontm17/healthcare-project-ai-service@sha256:c080a7c8820cf096fed64fcc4acbf18e5db38fdde811e469bbd699d8e69770fe`, Render deploy `dep-db3fjpbtqb8s73dq1s90` LIVE, `/livez` 200. Readiness endpoints returned 401 without service authentication; anonymous readiness is not claimed as PASS.
- V114 initially failed because the limited application database role is not table owner. After explicit operator approval, the owner applied the V114 DDL and matching Flyway history atomically; checksum `1016370147` was computed with Flyway 11.7.2. Schema/constraints/history were independently read back by the lead. The backend then reported schema 114 up to date. No runtime privilege escalation, ownership changes, user-data deletion, or Flyway repair occurred.
- Password forms capture actual DOM values and preserve autofill across rejected submissions. New/reset/change passwords reject inputs above 72 UTF-8 bytes before hashing; login/current-password/Google staff proof reject oversized inputs before matching. Passwords are not trimmed or silently truncated.
- Local evidence: 19 password-boundary tests, 64 focused auth/Google tests, 12 running-build browser regressions, and 14 real local role/registration checks PASS. Registration 202 -> Mailpit OTP -> native DOM OTP submission -> PATIENT session was exercised without mocked backend responses.
- Production evidence: 15 safe smoke checks PASS. Patient/doctor/admin login routing, anonymous 401, cross-role 403, and logout revocation were exercised with test personas. Oversized registration returned 400 with a password field error. Valid registration UI used an intercepted response; no real production signup/email was performed.
- Public BFF chat canary returned 200 with four citations. This is a bounded smoke check, not a comprehensive chatbot quality evaluation.
- Google client ID is configured consistently on Render/Vercel; GIS button and SDK load on production login/register. Real interactive Google authentication remains NOT_RUN. Verify Authorized JavaScript origins for both production hostnames and complete a real consent/sign-in journey before claiming end-to-end Google provider success. Client Secret is not required for this GIS ID-token flow and was not added to source or frontend.
- Demo/test persona login remains enabled on the beta backend. Do not call this a fully locked-down non-demo production deployment; disabling demo access needs a separate coordinated configuration decision.
- Security scanner self-match was repaired without changing accepted detection patterns or excluding files; regression fixtures confirm private-key/token/JWT detection. Hygiene CI PASS does not prove historical Git secret eradication.
