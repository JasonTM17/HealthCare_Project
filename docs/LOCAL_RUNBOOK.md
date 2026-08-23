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
before running the browser gate:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:<frontend-port>"
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
docker compose -f infrastructure/docker-compose.yml ps
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
docker compose -f infrastructure/docker-compose.yml logs --tail 200 backend ai-service frontend
docker compose -f infrastructure/docker-compose.yml down
```

Use `down -v` only when intentionally deleting all disposable local database,
Redis and MinIO data.
