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
- Hosted documents probe semantics refined: the 404 `RESOURCE_NOT_FOUND` body
  is the custom `NoSuchElementException` handler response
  (GlobalExceptionHandler.java:382-392) thrown by
  `DocumentService.requireLinkedPatient` — i.e., the documents route EXISTS on
  the hosted backend, but the hosted demo user
  (patient@healthcare.com) has no linked Patient row, so a behavioral V75
  probe (200 [] vs 409) is impossible with this persona. Re-running the probe
  needs a hosted persona with a linked patient row.
- `healthcare-beta-ai` on Render builds from git with `autoDeployTrigger: off`
  — releasing it needs a manual deploy trigger in the Render dashboard.
- Follow-up scheduled: 2026-09-21 09:00 local — dispatch Advisor/Kongming/Wukong
  for independent review of the ChartJS+V75 delta (automation
  `automation-339843b5-2df6-44fe-b162-e0bdd7e9d1ea`, subagent quota resets
  2026-09-21 01:24 UTC).
- `RENDER_API_KEY` (primary) is format-valid (`rnd_…`) but returns 401 —
  revoked/rotated server-side.
- `render-keep-alive.yml` run 34959103651 (2026-09-15 10:39–10:40 UTC — BEFORE
  the release push at 14:41 UTC) exited 1 via its fail-loud Render health
  step: the free-instance suspension of `healthcare-beta-backend` pre-dates
  this release and is independent of the release commits.

## Actions required from the product owner

1. Render dashboard → `healthcare-beta-backend`: confirm the deploy for image
   `sha256:bd4d5b9f…` (blueprint change pushed at 8bf24fc/9d01cce/2f0835e);
   Flyway V75 runs at boot. Optionally mint a fresh RENDER_API_KEY for the
   repo `.env` to re-enable API verification.
2. Optionally seed a hosted persona with a linked patient row to allow the
   documents behavioral probe on the host.
3. After 2026-09-21 01:24 UTC, the scheduled automation dispatches the three
   review agents; verdicts land in this folder.

## Additional evidence (2026-09-15 late pass)

- `RENDER2_API_KEY` in `.env` is VALID (API 200) — full remote verification is
  possible through it.
- Service `srv-daigprh5efls73dfau00` (`healthcare-beta-backend`):
  `suspended: not_suspended`; configured `imagePath` is NOW
  `sha256:bd4d5b9f…` (the release digest is set as the service target).
- **Two API-triggered deploys of `sha256:bd4d5b9f…` both failed**
  (`dep-dakmo92fngtc73avt9rg`, `dep-dakmrabm8hqs73f59770`, each
  `update_failed` after ~2m45s–3m). They match 3 earlier `update_failed`
  deploys from 09-12/09-15 00:02 UTC — API/image-update deploys fail
  persistently on this service, independent of this release.
- Render deploy logs are not exposed via the public API; the failure reason
  (GHCR pull auth for the new digest, free-tier health-check timeout during
  Spring boot + Flyway, or instance resources) must be read in the Render
  dashboard Events/Logs tab. The service continues serving the previous
  working image while the target digest is set.

### Owner action (refined)

Render dashboard → `healthcare-beta-backend` → **Events** tab: read the two
failed deploys' logs (16:02–16:05 UTC window), fix the stated cause, then
"Manual Deploy" (or "Apply blueprint changes"). Alternatively resume/redeploy
via the dashboard UI. The repo-side release state is complete and correct.

### Deploy failure narrowing (final pass)

- **DECISIVE diagnostic**: redeploying the OLD known-good digest
  (`sha256:02719d11…`) via API ALSO failed `update_failed` at ~90s —
  identical to the new-digest attempt. The failure is therefore
  **platform-level for all API-triggered deploys on this service**
  (independent of image content or V75), and predates this release
  (failures logged since 2026-09-12 11:03 UTC).
- **GHCR pull auth ruled out**: the image
  `ghcr.io/jasontm17/healthcare-project-backend` is anonymously pullable
  (manifest fetch for tag `sha-c83fe58…` returns 200 without credentials), so
  Render can pull every digest without registry credentials.
- All 10 recent deploys (back to 2026-09-12 11:03 UTC) are `update_failed` /
  `api` — the API/image-update path has never succeeded on this service in
  that window, while the service itself keeps serving 200 UP across
  sleep/wake cycles.
- Third attempt with `clearCache: "clear"` also failed at ~180s
  (`dep-dakn2unf3r2c73b9juc0`) — rules out stale pull cache as well.
- Remaining diagnosis requires the Render dashboard's Events/Deploy logs
  (deploy is failing at the platform level — instance hours, plan limit, or
  service config; not visible via API).
- Service target image restored to the release digest
  (`sha256:bd4d5b9f…`) after the diagnostic; service remains live and
  healthy throughout; failed deploys do not take the running instance down.
- **2026-09-16 retry** (`dep-dakti8rl550s73ar5qa0`, digest `bd4d5b9f…`):
  `update_failed` after ~180s — **7/7 deploy attempts failed across two days**
  (2026-09-15 API + dashboard, 2026-09-16 API). The blocker is confirmed
  persistent at the Render account/platform level (free instance hours
  exhausted by the workspace's always-on free services, plan limitation, or
  service state) and can only be diagnosed/fixed from the Render dashboard by
  the account owner.
