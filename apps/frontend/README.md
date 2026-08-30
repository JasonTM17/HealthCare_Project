# Frontend

Next.js TypeScript frontend baseline for HealthCare_Project.

Use Node.js 22-24 with npm 10-11. `npm ci` consumes the committed lockfile and
is the same install mode used by CI and Vercel.

The package contract is intentionally bounded: Node.js `>=22 <25`, npm
`>=10 <12`, and lockfile version 3. The direct runtime/tooling pins are Next.js
`16.3.3`, React `19.2.8`, `eslint-config-next` `16.3.3`, and TypeScript
`6.0.3`; the Playwright range currently resolves to `1.62.1`. Keep
`package.json` and `package-lock.json` in sync;
use `npm ci` for CI, Vercel, and release builds.

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
