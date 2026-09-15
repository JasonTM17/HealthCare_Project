# Deploy verification — 2026-09-15 (release c83fe58 + digest bump 2f0835e)

## What shipped

- Push `d852f05..c83fe58` (7 commits): Chart.js admin insights, a11y/portal-nav
  polish, `lib/site-url.ts`, migration `V75__allow_document_target_in_clinical_access_audit.sql`,
  package-booking copy, audit report, release plan.
- Push `c83fe58..2f0835e` (3 commits): backend image digest bump
  `sha256:bd4d5b9f…` in `render.yaml` + canonical `render-free-beta.yaml`
  + `BACKEND_DIGEST` contract constant, following the repo's deliberate
  digest-bump release contract.

## Gates observed

- FE: lint clean, typecheck clean, 328/328 unit tests.
- `test_render_blueprint_contract.py`: 8/8 PASS after syncing the canonical
  manifest and the pinned-digest expectation (2 intermediate failures were
  release-contract friction: canonical-manifest parity + digest constant).
- CI GitHub Actions run 34983313973 on c83fe58: **SUCCESS**.
- publish-images run 34984859727 on c83fe58: **SUCCESS** — backend image
  `ghcr.io/jasontm17/healthcare-project-backend@sha256:bd4d5b9f…` published
  with provenance attestation (also ai-service, frontend, attachment-scanner).

## Hosted state at verification time

| Endpoint | Result |
|---|---|
| `https://www.healthcare.id.vn` | 200 (live) |
| `…/auth/login` login → patient portal | PASS |
| Render backend `/actuator/health` | 200 `{"status":"UP"}` (free-tier sleeps between polls: intermittent 000 while scaled down) |
| Hosted documents probe (patient …0022) | 404 `RESOURCE_NOT_FOUND` (business error) — **no 409 CONFLICT**, the V75 bug signature is absent on the host |

## Boundary (not verifiable from this environment)

- Render API key in `.env` returns 401 → deploy status of image digest
  `sha256:bd4d5b9f…` cannot be read from the Render dashboard/API here. The
  blueprint digest change is pushed; Render applies it per the repo's
  digest-pin release convention. Confirm "Deploy live" for
  `healthcare-beta-backend` in the Render dashboard, then Flyway V75 applies
  at boot.
- The hosted demo database uses a different seed lineage (patient ids
  `90000000-…`) than local, so behavioral probes are weaker evidence than the
  local reproduction of the 409 (verified fixed after V75 locally).
- `healthcare-beta-ai` on Render builds from git with `autoDeployTrigger: off`
  — releasing it needs a manual deploy trigger in the Render dashboard.
- Follow-up scheduled: 2026-09-21 09:00 local — dispatch Advisor/Kongming/Wukong
  for independent review of the ChartJS+V75 delta (automation
  `automation-339843b5-2df6-44fe-b162-e0bdd7e9d1ea`, subagent quota resets
  2026-09-21 01:24 UTC).
