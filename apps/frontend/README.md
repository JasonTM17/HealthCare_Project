# Frontend

Next.js TypeScript frontend baseline for HealthCare_Project.

Use Node.js 22-24 with npm 10-11. `npm ci` consumes the committed lockfile and
is the same install mode used by CI and Vercel.

The package contract is intentionally bounded: release `0.1.1`, Node.js
`>=22 <25`, npm `>=10 <12`, and lockfile version 3. The direct runtime/tooling pins are Next.js
`16.3.3`, React `19.2.8`, `eslint-config-next` `16.3.3`, and TypeScript
`6.0.3`, and Playwright `1.62.1` (exactly pinned). Keep
`package.json` and `package-lock.json` in sync; use `npm ci` for CI, Vercel,
and release builds. On 2026-09-01, the dry-run install and lockfile audit
passed with zero vulnerabilities across 453 packages. Next.js and
`eslint-config-next` `16.3.4` are available, but the hosted, attested beta
remains on the tested `16.3.3` pair until a separate compatibility-and-republish
checkpoint; major toolchain upgrades remain deferred as well.

## Commands

```bash
npm ci
npm run verify
npm run test:e2e
npm run dev
```

`npm run verify` is the local release gate (lint, typecheck, unit tests, and
production build). Run `npm run test:e2e` separately for the browser gate.
Major toolchain upgrades are intentionally deferred until their compatibility
with the current Next.js/Tailwind setup is reviewed.

## Hosted build contract

Vercel must use `apps/frontend` as the project root. The checked-in
`vercel.json` pins the install command to `npm ci` and the build command to
`npm run build`; `npm run test:chat-contract` is the focused BFF/guest-chat gate;
do not use `npm install` or a floating package version in a
release build. The current published application artifacts are bound to exact
commit `f4e27cac81a1b8c887307afef070c0a7adb081d4`; Vercel deployment
`dpl_CAq7vyis5nXqHTwM315e6HV2ryNC` is `READY` for production and was created
from a clean exact-SHA checkout with the CLI. The manual deployment has no
provider Git metadata, so do not infer a Git integration deployment or an
automatic redeploy after release-documentation changes. Render backend deploy
`dep-dab3crn40ujc739msk80` is live on the corresponding immutable image, and
native-AI deploy `dep-dab3bvs9v7es73btkufg` reports the same source SHA.

The browser-facing API is the same-origin Next.js BFF. Keep
`BACKEND_INTERNAL_URL`, `BFF_PUBLIC_ORIGIN`, and `BACKEND_BFF_SERVICE_TOKEN`
server-only; never rename them to `NEXT_PUBLIC_*`. The production Vercel beta
has these values paired with the Render Free backend, so catalog requests are
served through the BFF (30 specialties, 475 active doctors, 20 branches;
public services/packages/articles are filtered to 192/95/467 and public FAQs
are 0 until an active doctor approval exists). If either provider secret is
missing or mismatched, the BFF intentionally fails closed with
`503 BFF_CONFIGURATION_UNAVAILABLE`.
The Free beta connects Spring to an authenticated local-provider FastAPI
service for hospital-support chat. `/api/v1/health` and the hosted guest-chat
contract passed on 2026-09-01, including normal `ANSWER`, Vietnamese
bypass/exfiltration `REFUSE`, emergency `EMERGENCY`, strict request-shape,
origin, reserved-header, and tokenless-direct-backend rejection checks. A
spun-down Render Free service can still make the first request slow. The
measured Spring cold start was about 285 seconds, beyond the 55-second public
chat deadline and the 60-second Vercel API-function limit; the first request
after idle can therefore return `502 BFF_UPSTREAM_UNAVAILABLE`. Wait for the
Render service to wake and use the assistant's `Thử lại` action. This is the
known Free-plan trade-off; no browser bypass, keep-alive job, or paid service is
configured. Remote
patient/clinical providers remain disabled, and no AI or ingest token is
exposed to the browser or bypasses the origin check.

Before opening a release, run `npm audit --package-lock-only` and verify that
the manifest fields in `package.json` match the root package entry in
`package-lock.json` (lockfile version 3). A passing local check does not prove
that Vercel or Render has deployed the same SHA.

## Design Rules

Use original healthcare content and visual identity. Hoan My is reference-only for information architecture patterns and must not be copied.

## Portal contract handoff

The first portal UI delivery consumes the existing authenticated contracts for patient medical records, prescriptions, diagnostic results, notifications, and doctor-to-patient clinical reads.

The patient dashboard reads the documented patient-scoped Page contract from
`GET /api/v1/patient/appointments`; the doctor dashboard reads the documented
doctor-scoped daily Page contract from
`GET /api/v1/doctor/appointments?date=yyyy-MM-dd[&status=...]`. The client
uses the least-privilege `PatientPortalAppointment` and
`DoctorPortalAppointment` types, so each portal mirrors the fields its backend
DTO actually exposes. Both reads use the same-origin BFF session and never fall
back to mock appointments; loading, empty, auth, forbidden, error, or
unavailable states remain explicit when a live backend cannot respond.

The portal uses an opaque Secure HttpOnly browser session through the same-origin
Next.js BFF; JavaScript keeps only non-secret session metadata in memory. It
never fabricates medical data and surfaces 401/403/empty/loading/error states in
the UI.

For a reverse-proxied build, configure server-only `BFF_PUBLIC_ORIGIN` to the
exact external origin (for example, the HTTPS Vercel beta domain). This keeps
the CSRF origin check stable even when the Route Handler sees an internal URL;
never expose this configuration or the BFF service token through `NEXT_PUBLIC_*`.
