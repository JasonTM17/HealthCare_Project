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

Two Phase 8–9 surfaces remain intentionally unmocked until the backend exposes contracts for them:

- Patient appointment list: a patient-scoped, paginated appointment query (including status/date filters) is needed before `/patient/appointments` can render real data. Until then, the patient dashboard links to the existing booking-code lookup at `/tra-cuu`.
- Doctor daily view: a doctor-scoped, paginated appointment query (including date/status filters and permitted patient summary) is needed before a daily schedule can render. The doctor dashboard only exposes the existing authorized patient clinical lookup.

The portal stores the backend access/refresh response in `sessionStorage` for this local educational flow, never fabricates medical data, and surfaces 401/403/empty/loading/error states in the UI.
