# Production Deployment Handoff — 2026-09-13

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
