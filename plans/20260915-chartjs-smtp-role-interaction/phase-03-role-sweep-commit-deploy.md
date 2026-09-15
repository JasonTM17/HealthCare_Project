# Phase 03 — Role-interaction sweep, review, commit, re-scan, deploy

## Steps
1. Multi-role browser sweep: guest booking (phase-01 journey), patient
   (dashboard/documents/consultation), doctor (consultation reply), admin
   (catalog CRUD + chart). Capture console errors per role.
2. Independent review agents on the frozen delta: Advisor (scope/UX),
   Kongming (architecture/contracts), Wukong (falsification of chart + mail
   claims). Apply required amendments.
3. Gates: lint, typecheck, unit (node --test), targeted e2e (booking-inline,
   core-flows booking, admin-critical-actions, patient-chat).
4. Commit accumulated audit work in conventional commits with explicit paths:
   - `fix(frontend): ...` audit fixes (session 1–3 leftovers)
   - `fix(backend): allow DOCUMENT target in clinical access audit` (V75)
   - `feat(frontend): admin appointments chart with Chart.js`
   - plan + report artifacts
   Never stage the parallel AI-workstream files.
5. Final re-scan round: axe public + portal spot list, multi-role console check.
6. Deploy: check `.vercel/`, `render.yaml`, CI. If hosted credentials exist,
   deploy per project convention; otherwise document exact readiness boundary.

## Acceptance
- All agent verdicts applied; gates green; commits pushed only after gates;
  final scan clean; deploy boundary documented in reports/.
