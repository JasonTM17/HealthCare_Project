# Local MVP runbook

## One-time Windows setup

Docker Desktop is installed, but Windows must enable WSL 2 from an elevated
PowerShell before the complete stack can start:

```powershell
wsl --install
```

Restart Windows, open Docker Desktop, and wait until the engine reports ready.

### Windows build 26200 socket recovery

On Windows build 26200, Docker Desktop may leave an inaccessible AF_UNIX
runtime endpoint (`dockerInference`, `sailor-ingest.sock`, or
`docker-secrets-engine\engine.sock`). The backend then exits during the next
start with `The file cannot be accessed by the system`. Do not use **Reset to
factory defaults** for this error: it is not required and can put local data at
risk.

Use the repository recovery launcher from PowerShell instead (the default
startup allowance is six minutes because a cold WSL resume can take longer
than the normal Docker UI spinner):

```powershell
.\scripts\start-docker-safe.ps1
```

For a deliberate restart, pass `-Restart`:

```powershell
.\scripts\start-docker-safe.ps1 -Restart
```

The launcher first uses Docker's supported stop command when the engine pipe is
responsive, with a hard timeout. If the backend is already broken, it skips the
known-hanging CLI path and force-stops only Docker Desktop processes plus the
`docker-desktop` WSL distribution. It then waits for Docker processes, the
engine pipe, and that distribution to quiesce before renaming the two exact
runtime parent directories to timestamped `.stale-*` folders and recreating
them. A parent that is itself a reparse point is rejected rather than
traversed. Active Docker containers are therefore stopped, but no
container/image/volume data is removed. The launcher does not touch
images/volumes/VHDX data, shut down other WSL distributions, or change
Hibernate. It verifies the local named-pipe engine and holds a short post-start
stability gate. The health check also requires `docker desktop status --format
json` to report `running`; Resource Saver can leave the named pipe and a cached
`docker version` response available while the Linux daemon is already stopped,
so the pipe or a successful cached version response alone is not treated as
readiness. The control-plane status probe drains stdout and stderr concurrently,
is bounded to five seconds, and fails closed; this prevents a noisy broken CLI
from filling a redirected Windows pipe and making recovery appear hung. If a
late Docker auxiliary process recreates a runtime socket after the
Desktop and WSL stop gates, the launcher rotates that exact parent again with a
bounded retry, keeps every copy in a separate recovery quarantine, and requires
the new parent to remain empty before starting Docker.

The no-`-Restart` path is safe for the per-user startup entry: when Docker
Desktop or its `docker-desktop` WSL distribution is already present but still
resuming, the launcher waits for that existing startup and does not issue a
stop, rotate runtime folders, or rewrite the settings store. When the host is
cleanly stopped, it starts Desktop through the Explorer broker without
rotating runtime folders. It only enters recovery after an explicit
error-dialog signal. If a bounded clean/startup wait expires without that
signal, it fails closed and leaves the host untouched; use an explicit
`-Restart` after checking Docker Desktop. This prevents two owners from
turning a slow cold start into a shutdown race while still allowing the
per-user startup entry to start a stopped Desktop.

The launcher also bounds every Docker/WSL CLI probe, shares one wall-clock
budget across multi-probe wait loops, and drains redirected output without
waiting indefinitely. A timed-out WSL probe is treated as
unknown rather than stopped: the quiescence gate keeps waiting and refuses
runtime rotation if the state cannot be proved safe. No broader WSL shutdown or
data-volume operation is attempted. The settings store is written only when
the AI/Inference values actually change, and recovery writes it after the
runtime parents are quarantined, so a repeated healthy auto-start does not
trigger an avoidable backend reload.

The workstation reported Docker Desktop `4.89.0.238018` on 2026-09-01, but the
[public Docker Desktop release notes](https://docs.docker.com/desktop/release-notes/)
did not yet document that build or confirm a fix for this inaccessible AF_UNIX
runtime-parent failure. Keep the repository recovery path enabled until Docker
closes the [upstream stale-socket issue](https://github.com/docker/desktop-feedback/issues/554)
or a later documented release is proven on this host. A pre-existing
inaccessible runtime parent can still fail after an update; this is not a
reason to reset Docker or uninstall it. Run the bounded restart path and keep
the quarantine folders for diagnostics:

```powershell
.\scripts\start-docker-safe.ps1 -Restart
```

Check the HKCU `Docker Desktop` Run value after every in-place Desktop update
and restore the repository launcher when necessary:

```powershell
.\scripts\install-docker-safe-launcher.ps1 -InstallAutoStart
```

This does not change Hibernate, the WSL data disk, images, volumes, or other
WSL distributions. Keep the legacy `Docker Desktop socket recovery` task
disabled so it cannot race the repository launcher.

The launcher also holds an OS-backed exclusive file handle for its complete
mutation window. A second launcher exits instead of racing a stop/start or
runtime-folder rotation; a crashed process releases the handle automatically.
Use exactly one terminal/task as the Docker host owner until the stability gate
finishes. The default startup preflight requires at least 2 GiB free on the
drive that hosts `%LOCALAPPDATA%\Docker`, because that drive still carries
Docker Desktop logs, sockets, and temporary runtime state even when the WSL data
disk is configured elsewhere. `-MinimumHostFreeBytes 0` is a diagnostic bypass,
not a normal recovery setting.

Docker AI/Model Runner and Inference are disabled and verified by default
before the launcher reports success because they are optional sources of the
same socket failure; use `-KeepDockerAI` only when that feature is explicitly
needed. The launcher reads the effective backend flags first and does not issue
the CLI toggle when both are already false; this avoids an unnecessary
asynchronous backend restart during the stability gate. If a toggle is needed,
it waits for the named-pipe engine to return before checking the persisted flags.
Failed starts preserve the quarantined folders for diagnostics and manual
rollback. The launcher reports the number and accessible byte size of known
`.stale-*` folders but never deletes them automatically.

The installer changes only the Start Menu shortcut by default; it leaves the
existing per-user AutoStart setting unchanged. `-InstallAutoStart` is an
explicit opt-in, and `-Restore` returns the shortcut/Run entry from retained
backups:

```powershell
.\scripts\install-docker-safe-launcher.ps1
.\scripts\install-docker-safe-launcher.ps1 -InstallAutoStart
.\scripts\install-docker-safe-launcher.ps1 -Restore
```

## Start the complete stack

From the repository root, copy `.env.example` to `.env` and replace the local
placeholder values for `JWT_SECRET`, `AI_SERVICE_TOKEN`, and the required
service secrets. Ordinary Compose keeps protected RAG ingestion disabled by
default; use the helper below when the disposable catalog-sync flow is needed.
Then run:

```powershell
docker compose --env-file .env -f infrastructure/docker-compose.yml config --quiet
docker compose --env-file .env -f infrastructure/docker-compose.yml up --build
```

Keep `--env-file .env` on every Compose command in this runbook. The Compose
project directory is `infrastructure/`, while the required local secrets are
in the repository-root `.env`; omitting the flag fails closed with a missing
secret error.

The default host ports are frontend `3000`, backend `8080`, AI service `8000`,
PostgreSQL `5434`, Redis `6379`, MinIO `9000`/`9001`, and Mailpit SMTP/API
`1025`/`8025`. Mailpit captures local auth email and never relays it. For an isolated run
beside another checkout, set `FRONTEND_HOST_PORT`, `BACKEND_HOST_PORT`,
`AI_SERVICE_HOST_PORT`, `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`,
`MINIO_API_HOST_PORT`, `MINIO_CONSOLE_HOST_PORT`, `MAILPIT_SMTP_HOST_PORT`,
and `MAILPIT_UI_HOST_PORT` before starting Compose.
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

If the local machine cannot run Docker Desktop yet, trigger the GitHub Actions
`Runtime Compose MVP` workflow manually for the exact commit. It runs the same
provenance-bound verifier on an Ubuntu runner with disposable local-only
secrets and stops the Compose project afterward. Treat that as live
local-runtime evidence, not production deployment evidence.

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

After the same Compose stack is running, run the browser-level role demo from
the frontend workspace. This gate uses the live frontend/backend/PostgreSQL
stack, does not intercept `/api/v1/**`, books through the public UI, and then
checks patient, doctor and admin pages for the same confirmed appointment:

```powershell
cd apps\frontend
npm run test:e2e:compose
```

When the Compose stack uses non-default host ports, set both live endpoints
before running the browser gate. Keep the frontend hostname as `localhost` so
the BFF's Secure `__Host-` cookies remain on the same host as
`BFF_PUBLIC_ORIGIN`; only the port needs to change:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://localhost:<frontend-port>"
$env:PLAYWRIGHT_API_BASE_URL = "http://127.0.0.1:<backend-port>/api/v1"
npm run test:e2e:compose
```

For the API-level same-day clinical lifecycle (doctor check-in, in-progress
visit, medical-record creation, `COMPLETED` appointment status in patient,
doctor and admin API views, the matching `APPOINTMENT_CONFIRMED` notification,
and own-patient record visibility), run during a day with a real available
local slot:

```powershell
.\scripts\verify-local-mvp.ps1 -RequireClinicalFlow
```

When the API is published on an isolated host port, pass the matching health
origin as well as `-ApiBaseUrl`, for example:
`.\scripts\verify-local-mvp.ps1 -ApiBaseUrl http://127.0.0.1:<backend-port>/api/v1 -BackendHealthUrl http://127.0.0.1:<backend-port> -FrontendUrl http://127.0.0.1:<frontend-port> -MailpitApiUrl http://127.0.0.1:<mailpit-ui-port>`.

This mode intentionally fails when there is no available same-day slot. It does
not fabricate a visit date or bypass the doctor status-transition rules. It
uses the hospital's Vietnam business date (`Asia/Ho_Chi_Minh` / Windows `SE Asia
Standard Time`) rather than the host-local date. It is an API verifier: it does
not prove browser rendering, cross-patient runtime isolation, or the source SHA
of an already-running Docker image. Keep the browser and authorization checks
in the role-based checklist below as separate gates.

The helper verifies that the backend, frontend, and AI service containers for
the current Compose project carry the same Git revision it built. A direct
`docker compose --env-file .env up --build` remains supported, but uses the explicit `unknown`
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

Never reuse these credentials outside the local seed. Seeded accounts are marked
email-verified; newly registered patients are not issued tokens until they
confirm the one-time email code.

Open `http://localhost:8025` to inspect verification and password-reset messages
for newly registered patients. The REST auth flow is:

1. `POST /api/v1/auth/register` returns `202` with a pending-verification state;
   it never returns an access token, refresh token, or OTP.
2. Confirm the code from Mailpit through
   `POST /api/v1/auth/email-verifications/confirm`; a successful confirmation
   returns the normal authenticated session.
3. Use `/auth/forgot-password` and `/auth/reset-password` for the password-reset
   OTP flow. Resend, expiry, attempt, replay, and rate-limit errors are mapped
   to stable API codes and safe Vietnamese UI messages.

Appointment confirmation remains a separate OTP boundary. Compose generates a
random code and delivers it through the same configured SMTP service. The fixed
value `123456` is accepted only in automated tests running with the Spring
`test` profile.

Patient chat is available at `/patient/chat` for authenticated `PATIENT`
accounts. The browser uses Spring REST conversation resources and never sends a
user ID or authoritative history. Spring stores conversations for 90 days by
default and supports user-initiated deletion; Supabase stores only public
catalog/RAG documents. Remote patient-chat providers remain disabled by default
with `AI_PATIENT_CHAT_REMOTE_ENABLED=false`.

When `AI_CHAT_CHUNKED_ENABLED=true`, the patient composer may use
`POST /api/v1/ai/conversations/{conversationId}/messages/stream`. Spring first
generates, safety-sanitizes, persists and revalidates the complete answer, then
emits the accepted text as `delta` events followed by a `done` event containing
the persisted exchange. The frontend verifies that the concatenated deltas
match the stored answer; a `404` response means the flag is off and triggers the
normal JSON message endpoint. This is persisted-answer chunking, not raw
token-level provider streaming. The browser renders only these sanitized
deltas, keeps the idempotency key for an ambiguous attempt, and reports a
retryable `REQUEST_TIMEOUT` if the stream body exceeds its 35-second deadline;
the BFF allows 30 seconds for this route (15 seconds for ordinary requests).

For local RAG durability, start/reset the isolated Supabase stack from the repo
root, then run its read-only SQL contract:

```powershell
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/healthcare_data_platform.sql
```

This proves migration, seed and RLS behavior only on a compatible Docker
runtime. A failed or unrun reset is not hosted Supabase evidence.

## Verify

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8000/health -Headers @{"X-AI-Service-Token"=$env:AI_SERVICE_TOKEN}
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
Invoke-WebRequest http://localhost:8025/livez -UseBasicParsing
docker compose --env-file .env -f infrastructure/docker-compose.yml ps
```

Open `http://localhost:3000/auth/login` and verify the patient, doctor and admin
portals with the accounts above.

## Bank-transfer payment demo

The local Compose environment enables a fictional bank account for UI and API
testing. Never send real money to the checked-in demo account. Replace
`PAYMENT_BANK_NAME`, `PAYMENT_BANK_ACCOUNT`, `PAYMENT_BANK_ACCOUNT_HOLDER`, and
`PAYMENT_DEFAULT_AMOUNT` with separately managed deployment values before any
shared use, or set `APP_PAYMENT_BANK_TRANSFER_ENABLED=false`.

After a confirmed appointment, the authenticated patient opens the payment
panel in `/patient/dashboard`, transfers using the exact immutable amount and
content, and submits only the bank transaction reference. An administrator then
checks the actual bank statement and reviews the item at `/admin/payments`.
Submitting a reference never marks an appointment paid by itself. The backend
serializes reviews, keeps retries idempotent, and moves a paid cancelled booking
to `REFUND_PENDING` rather than discarding its payment state.

Booking OTP confirmation also creates a unique account claim when a verified,
active PATIENT account has the same normalized email. This lets a public booking
appear in that account without rewriting its medical profile or phone number.
If registration happens after booking, matching unlinked booking profiles are
reused and email verification claims previously confirmed appointments. The
database unique constraint ensures one appointment cannot be claimed by two
accounts.

VietQR is generated server-side from `PAYMENT_BANK_BIN`, the snapshotted amount,
and the immutable transfer content. The patient must still verify the receiving
account name in their banking app. Never guess `PAYMENT_BANK_ACCOUNT_HOLDER`.

Automatic reconciliation is disabled unless `PAYMENT_WEBHOOK_SECRET` contains
at least 32 characters. A provider adapter sends JSON with `transferContent`,
`amount`, and `transactionReference` to
`POST /api/v1/payments/webhooks/bank-transfer`, plus `X-Webhook-Id`, Unix-second
`X-Webhook-Timestamp`, and `X-Webhook-Signature`. The signature is lowercase
hex HMAC-SHA256 over `<timestamp>.<raw JSON body>`. Event IDs are persisted to
block replay, timestamps expire after five minutes by default, and amount plus
transfer content must match exactly.

This is a provider-neutral inbound contract: the backend does not log in to
Vietcombank, scrape account activity, or claim a direct bank integration. A
separately operated, authorized provider adapter must translate its event into
the contract above, retain the exact raw JSON used for signing, generate a
stable event ID, and retry the identical event on timeout. Event IDs accept only
letters, digits, `.`, `_`, `:`, and `-` (maximum 120 characters); the request
body is capped at 4096 characters and the signature must be 64 hexadecimal
characters, optionally prefixed by `sha256=`.

Patient submissions require an `Idempotency-Key`. Admin review and refund
transitions are state guarded and recorded in `payment_audit_logs`. Cancelling a
paid appointment creates `REFUND_PENDING`; an admin must record the real bank
refund reference before the status becomes `REFUNDED`.

Successful verification, rejection, and completed refund also schedule a
best-effort patient email after the database transaction commits. Those emails
contain only the booking code and safe portal guidance; transaction/refund
references, bank details, rejection reasons, clinical data, and appointment
reason are deliberately omitted. SMTP failure cannot roll back an already
committed payment transition. Set `PAYMENT_STATUS_EMAIL_ENABLED=false` to turn
off these status messages independently of security OTP mail.

## Gmail SMTP

Local Compose intentionally uses Mailpit. To send real Gmail mail, set the
backend container values to `smtp.gmail.com`, port `587`, enable SMTP auth and
STARTTLS, and provide a Gmail address plus a Google App Password through `.env`
or the deployment secret manager. Do not commit the App Password. Keep Mailpit
until both credentials are available; otherwise OTP delivery will fail.

## Role-based demo checklist

1. Open `/`, then browse specialties, doctors, branches and services.
2. Register a new patient or sign in as `patient@healthcare.local`.
3. Open search and ask in Vietnamese about `đau đầu và chóng mặt`; verify that
   the AI result contains a safety disclaimer and catalog-backed provenance.
4. Open `/patient/chat`, create a conversation, send a question, reload the page
   and verify server-owned history, citations, retry and delete behavior.
5. Open `/dat-lich`, select a real doctor, branch, date and available slot.
6. Hold the slot, read the random OTP from Gmail or Mailpit, and confirm it.
7. Verify the appointment in `/patient/dashboard` and its in-app notification.
8. Sign in as `doctor@healthcare.local`; open `/doctor/dashboard` for the booked date.
9. Move the appointment through check-in and in-progress states in the allowed order.
10. Create the consultation record and optional prescription/diagnostic metadata.
11. Sign back in as the patient and verify only that patient's permitted record,
    prescription, diagnostic result, protected file and notifications are visible.
12. Sign in as `admin@healthcare.local`; open `/admin/appointments` and verify the
    booking appears with the correct date/status, then inspect catalog/schedules.
13. Confirm that anonymous/non-admin access to admin APIs is rejected and that
    another patient cannot read the first patient's clinical/file resources.

The backend also exposes `POST /api/v1/admin/ai/catalog/sync` for an authenticated
ADMIN to perform a bounded catalog refresh and receive an explicit processed
document count. Scheduled synchronization remains enabled for normal operation.

## Backup and production environment gate

With PostgreSQL and MinIO running, create a uniquely named backup directory:

```powershell
.\scripts\backup-local-data.ps1 -OutputDirectory D:\encrypted-backups\healthcare
```

When the stack uses a private Compose fixture, pass its environment file
explicitly so the backup command resolves the same required bootstrap secret
contract as `compose up`:

```powershell
.\scripts\backup-local-data.ps1 -ProjectName healthcare-beta-fe95805 `
  -EnvFile D:\secure\healthcare-beta.runtime.env `
  -OutputDirectory D:\encrypted-backups\healthcare-beta
```

The script streams a PostgreSQL custom archive without text transcoding, copies
MinIO source data without changing it, and writes file sizes plus SHA-256 hashes
to `manifest.json`. It never deletes source data or overwrites an existing
snapshot. Treat the result as sensitive and perform restore tests only against
disposable PostgreSQL/MinIO instances. Production needs scheduled encrypted
off-site retention, alerting on failures, and documented recovery objectives;
one successful local backup is not restore evidence.

Validate a private production environment file before deployment:

```powershell
.\scripts\validate-production-env.ps1 -EnvFile C:\secure\healthcare.production.env
```

The validator fails on placeholder/short secrets, local/test profiles, fixed
booking OTP, disabled rate limiting, non-HTTPS CORS, local SMTP, incomplete
STARTTLS/auth, invalid bank identifiers, and a short reconciliation webhook
secret. It prints variable names and findings, never values.

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
docker compose --env-file .env -f infrastructure/docker-compose.yml logs --tail 200 backend ai-service frontend
docker compose --env-file .env -f infrastructure/docker-compose.yml down
```

Use `down -v` only when intentionally deleting all disposable local database,
Redis and MinIO data.
