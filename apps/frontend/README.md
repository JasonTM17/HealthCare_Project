# Frontend

Next.js TypeScript frontend baseline for HealthCare_Project.

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run dev
```

## Design Rules

Use original healthcare content and visual identity. Hoan My is reference-only for information architecture patterns and must not be copied.

## Portal contract handoff

The first portal UI delivery consumes the existing authenticated contracts for patient medical records, prescriptions, diagnostic results, notifications, and doctor-to-patient clinical reads.

The patient dashboard now reads the documented patient-scoped Page contract from
`GET /api/v1/patient/appointments`; the doctor dashboard reads the documented
doctor-scoped daily Page contract from
`GET /api/v1/doctor/appointments?date=yyyy-MM-dd[&status=...]`. Both reads use
the stored session token and never fall back to mock appointments. The exact
backend candidate `760735cd91b41ca25b009b4661ee55dc2c7482a` is not present in
this frontend worktree, so live integration remains pending; until that
candidate is integrated and running, the UI reports loading, empty, auth,
forbidden, error, or unavailable states honestly.

The portal stores the backend access/refresh response in `sessionStorage` for this local educational flow, never fabricates medical data, and surfaces 401/403/empty/loading/error states in the UI.
