# Local MVP runbook

## One-time Windows setup

Docker Desktop is installed, but Windows must enable WSL 2 from an elevated
PowerShell before the complete stack can start:

```powershell
wsl --install
```

Restart Windows, open Docker Desktop, and wait until the engine reports ready.

## Start the complete stack

From the repository root, copy `.env.example` to `.env` and replace the local
placeholder values for `JWT_SECRET`, `AI_SERVICE_TOKEN`, and the separate
`RAG_INGEST_TOKEN`. Then run:

```powershell
docker compose -f infrastructure/docker-compose.yml config --quiet
docker compose -f infrastructure/docker-compose.yml up --build
```

The default host ports are frontend `3000`, backend `8080`, AI service `8000`,
PostgreSQL `5434`, Redis `6379`, and MinIO `9000`/`9001`. For an isolated run
beside another checkout, set `FRONTEND_HOST_PORT`, `BACKEND_HOST_PORT`,
`AI_SERVICE_HOST_PORT`, `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`,
`MINIO_API_HOST_PORT`, and `MINIO_CONSOLE_HOST_PORT` before starting Compose.
The Compose services intentionally avoid fixed `container_name` values so
containers and volumes remain scoped to the current Compose project.

Alternatively, when `.env` is absent, the Windows helper creates a git-ignored
disposable full-MVP environment with generated JWT/AI/RAG secrets, then builds
the stack, waits for the idempotent seed, forces an ADMIN-authorized RAG catalog
sync, snapshots the checked-out Git revision into a temporary tracked-source
build context, labels the rebuilt backend/frontend/AI images with that revision,
and runs the automated patient/doctor/admin booking smoke flow. It fails closed
if Git cannot provide a 40-character revision, if the source identity changes
during the build, or if the working tree has tracked or untracked source changes
before or after the build. The temporary snapshot is removed after verification.
It does not alter an existing `.env`: the existing file must explicitly enable RAG and
contain a nonempty RAG token. Compose defaults remain fail-closed.

```powershell
.\scripts\start-and-verify-local-mvp.ps1
```

To explicitly prepare or repair an existing local `.env` without building or
restarting containers, use:

```powershell
.\scripts\start-and-verify-local-mvp.ps1 -PrepareOnly
```

The verifier creates one disposable confirmed appointment. It also proves that
the patient, doctor and admin can all see that booking and that a patient token
is denied by the admin appointment endpoint. To verify an already-running stack:

```powershell
.\scripts\verify-local-mvp.ps1
```

For the API-level same-day clinical lifecycle (doctor check-in, in-progress
visit, medical-record creation, `COMPLETED` appointment status in patient,
doctor and admin API views, the matching `APPOINTMENT_CONFIRMED` notification,
and own-patient record visibility), run during a day with a real available
local slot:

```powershell
.\scripts\verify-local-mvp.ps1 -RequireClinicalFlow
```

This mode intentionally fails when there is no available same-day slot. It does
not fabricate a visit date or bypass the doctor status-transition rules. It
uses the hospital's Vietnam business date (`Asia/Ho_Chi_Minh` / Windows `SE Asia
Standard Time`) rather than the host-local date. It is an API verifier: it does
not prove browser rendering, cross-patient runtime isolation, or the source SHA
of an already-running Docker image. Keep the browser and authorization checks
in the role-based checklist below as separate gates.

The helper verifies that the backend, frontend, and AI service containers for
the current Compose project carry the same Git revision it built. A direct
`docker compose up --build` remains supported, but uses the explicit `unknown`
provenance default and cannot establish an exact source-to-image runtime proof
on its own.

The one-shot `local-seed` container runs after Flyway and backend health. It
creates fictional catalog data, recurring schedules, and these disposable local
accounts (all use password `LocalDemo!2026`):

| Role | Email |
| --- | --- |
| Admin | `admin@healthcare.local` |
| Doctor | `doctor@healthcare.local` |
| Patient | `patient@healthcare.local` |

Never reuse these credentials outside the local seed.

Because the local stack does not send SMS/email, appointment confirmation uses
the disposable demo OTP `123456`. The default application setting remains
disabled; Compose enables it only for this local workflow.

## Verify

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8000/health -Headers @{"X-AI-Service-Token"=$env:AI_SERVICE_TOKEN}
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
docker compose -f infrastructure/docker-compose.yml ps
```

Open `http://localhost:3000/auth/login` and verify the patient, doctor and admin
portals with the accounts above.

## Role-based demo checklist

1. Open `/`, then browse specialties, doctors, branches and services.
2. Register a new patient or sign in as `patient@healthcare.local`.
3. Open search and ask in Vietnamese about `đau đầu và chóng mặt`; verify that
   the AI result contains a safety disclaimer and catalog-backed provenance.
4. Open `/dat-lich`, select a real doctor, branch, date and available slot.
5. Hold the slot and confirm it with local OTP `123456`.
6. Verify the appointment in `/patient/dashboard` and its in-app notification.
7. Sign in as `doctor@healthcare.local`; open `/doctor/dashboard` for the booked date.
8. Move the appointment through check-in and in-progress states in the allowed order.
9. Create the consultation record and optional prescription/diagnostic metadata.
10. Sign back in as the patient and verify only that patient's permitted record,
    prescription, diagnostic result, protected file and notifications are visible.
11. Sign in as `admin@healthcare.local`; open `/admin/appointments` and verify the
    booking appears with the correct date/status, then inspect catalog/schedules.
12. Confirm that anonymous/non-admin access to admin APIs is rejected and that
    another patient cannot read the first patient's clinical/file resources.

The backend also exposes `POST /api/v1/admin/ai/catalog/sync` for an authenticated
ADMIN to perform a bounded catalog refresh and receive an explicit processed
document count. Scheduled synchronization remains enabled for normal operation.

## Quality gates

```powershell
cd apps/backend
.\mvnw.cmd verify

cd ..\frontend
npm run lint
npm run typecheck
npm test
npm run build

cd ..\ai-service
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\mypy.exe app
.\.venv\Scripts\python.exe -m pytest
```

Backend integration tests require PostgreSQL/Testcontainers and MinIO. If
Docker is not ready, Maven compilation still works with
`.\mvnw.cmd -DskipTests package`, but that is not an end-to-end verification.

## Stop and diagnose

```powershell
docker compose -f infrastructure/docker-compose.yml logs --tail 200 backend ai-service frontend
docker compose -f infrastructure/docker-compose.yml down
```

Use `down -v` only when intentionally deleting all disposable local database,
Redis and MinIO data.
