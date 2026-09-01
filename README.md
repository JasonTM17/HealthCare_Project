# HealthCare_Project

HealthCare_Project is a healthcare MVP for a Vietnamese hospital-style experience. It is an educational/local-development project; passing local checks does not establish production healthcare, compliance, or deployment readiness.

## Status

The repository currently has auth/RBAC, branch-aware booking and rescheduling, bounded OTP confirmation, appointment lifecycle/reminders, patient and doctor portals, bank-transfer payment reconciliation, authorized clinical records and diagnostic files, complete hospital catalog administration, recurring schedule administration, AI/RAG/search guardrails, MinIO metadata, and CI definitions. Backend, AI, frontend static/typecheck/lint/build, Compose-configuration, database-fixture, and a Playwright CMS realtime browser gate are wired in CI. The browser gate proves the admin-to-public homepage CMS flow against a mocked backend contract; full live Compose browser E2E, backup/restore drills, external AI provider validation, compliance, and production deployment remain separate gates.

## Web preview

These checked-in visuals were captured from the public synthetic beta alias on
2026-08-31. They are a product preview of public pages only; they do not prove
authenticated booking, clinical workflows, chatbot JSON/SSE, backup/restore,
or production readiness. See the [beta deployment runbook](docs/deployment-beta.md)
for the executable checks and current hosted evidence.

[![HealthCare synthetic beta homepage](assets/images/healthcare-beta-home.png)](https://healthcare-two-olive.vercel.app/)

![HealthCare synthetic beta public-route tour](assets/videos/healthcare-beta-tour.gif)

The tour covers `/`, `/specialties`, `/doctors`, `/services`, and `/about` at a
960×600 viewport. Each capture returned HTTP 200 when recorded; the GIF is an
illustrative visual artifact, not a substitute for the browser and API gates.

## Hosted Beta Release Record

This is an evidence record for the synthetic beta, not a production-readiness,
clinical-compliance, or real-patient approval. The application release
candidate is exact source `f4e27cac81a1b8c887307afef070c0a7adb081d4` on
`main`. GitHub [CI run 33412705957](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33412705957)
passed all backend, frontend, AI, database, infrastructure, and hygiene jobs;
[image run 33413160881](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33413160881)
published the four application images with provenance/SBOM. Bind any release
to the exact source SHA and immutable digest, never to `latest`.

The hosted payload is deliberately limited to Render Free + Supabase Free +
Vercel. `render.yaml` is canonical and `render-free-beta.yaml` is its parity
copy. Remote patient/clinical AI, ClamAV, attachment scanning, object storage,
mail and payment consumers remain fail-closed.

| GHCR package | Immutable reference | Source/audit SHA |
| --- | --- | --- |
| [backend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-backend) | `ghcr.io/jasontm17/healthcare-project-backend@sha256:fff9292b1852139db1a6d9354cf84447ddf9274d6abde7e3d776015057fa6517` | `f4e27ca` |
| [AI service](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-ai-service) | `ghcr.io/jasontm17/healthcare-project-ai-service@sha256:71b7fff32db7d8b51d7490cddb5f8b3bd126302d0f42887054ab2cba99e2231a` | `f4e27ca` |
| [attachment scanner](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-attachment-scanner) | `ghcr.io/jasontm17/healthcare-project-attachment-scanner@sha256:ce0566ac368b18770fd16f208bf7860895567d9ab8a8f3f71998727c6a746739` | `f4e27ca` |
| [frontend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-frontend) | `ghcr.io/jasontm17/healthcare-project-frontend@sha256:ab53d9be2f2427f3961eaece9b255b43f9b80c3e7b9af7139593efe9e64df24f` | `f4e27ca` |
| [database fixture](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-database) | `ghcr.io/jasontm17/healthcare-project-database@sha256:d3863eef07879b2fe46ac56636c2908c68d2619be5790f40af7fb522ea7da044` | `7a083ab` (unchanged fixture) |

### Frontend package contract

The only npm workspace is `apps/frontend`; release `0.1.1` keeps `package.json`
and `package-lock.json` in lockfile v3 sync. The release-tested contract is
Node.js `>=22 <25` with npm `>=10 <12`, installed with `npm ci`; the focused
`npm run test:chat-contract` gate covers the public chatbot/BFF boundary.

- Runtime pins: Next.js `16.3.3`, React `19.2.8`, and React DOM `19.2.8`.
- Tooling pins: `eslint-config-next` `16.3.3`, TypeScript `6.0.3`, and
  `@playwright/test` `1.62.1` (exactly pinned in both manifests).
- The local/CI gate is `npm run verify` (lint, typecheck, unit tests, and
  production build), followed by `npm run test:e2e` for the browser gate.

On 2026-09-01, `npm ci --dry-run --ignore-scripts --no-audit --no-fund`, the
manifest/lockfile synchronization check, and
`npm audit --package-lock-only --audit-level=moderate` all passed; the audit
reported zero vulnerabilities across 453 packages. `npm outdated` reports the
available Next.js/`eslint-config-next` patch `16.3.4` plus major upgrade lines
(ESLint 10, Tailwind CSS 4, and TypeScript 7). The checked-in, attested beta
artifact remains on the tested `16.3.3` pins; upgrading the patch or a major
toolchain is deferred to a separate compatibility-and-republish checkpoint.

- Vercel stable [beta alias](https://healthcare-two-olive.vercel.app) is
  `READY`/Production at deployment
  `dpl_CAq7vyis5nXqHTwM315e6HV2ryNC`, created from a clean exact-`f4e27ca`
  checkout. The manual deployment has no provider git metadata, so the
  checkout SHA—not an inferred Vercel commit—is the source identity. The three
  BFF variables remain server-only (`BACKEND_INTERNAL_URL`, `BFF_PUBLIC_ORIGIN`,
  and `BACKEND_BFF_SERVICE_TOKEN`).
- Render workspace `tea-d7ev54q8qa3s7382ljcg` has the Free Singapore
  PostgreSQL, Key Value, image Spring service `srv-daa41a9f2nfc7395eg1g`, and
  native-Python AI service `srv-daal7kgn74is73bafjqg`. After the Singapore
  provider incident cleared, exact-f4 backend deploy
  `dep-dab3crn40ujc739msk80` reached `live`; its requested source manifest is
  `sha256:fff9292b1852139db1a6d9354cf84447ddf9274d6abde7e3d776015057fa6517`
  and Render resolved platform manifest is
  `sha256:f839c4e15818eb1c50519f46653aee5247cbfdd7e14867d13656e5991c638d3b`.
  Direct `/actuator/health` returned HTTP 200 with `status: UP`.
- Exact-f4 native-AI deploy `dep-dab3bvs9v7es73btkufg` reached `live` at
  `/livez` (HTTP 200) and reports commit
  `f4e27cac81a1b8c887307afef070c0a7adb081d4`. The Vercel canary now proves
  normal public chat (`ANSWER`), Vietnamese bypass/exfiltration refusal
  (`REFUSE`), emergency routing (`EMERGENCY`), origin enforcement, strict
  payload rejection, and tokenless direct-backend denial.
- The hosted synthetic catalog remains 30 specialties, 20 branches, 500
  doctors, 200 services, 100 packages, 500 articles, 150 raw FAQs, 1,247
  doctor-specialty links, 747 doctor-branch links, and 830 chat-projection
  rows where checked. The Vercel BFF probes returned HTTP 200 totals of 30
  specialties, 475 active doctors, 20 branches, 192 services, 95 packages,
  467 articles and 0 public FAQs. External PostgreSQL access is closed; Render
  Free PostgreSQL is time-limited and Key Value is ephemeral.
- Supabase project `awaknzhadjglbfkhigck` is on the Free plan with eight audited
  migration rows, 15 RLS-enabled `healthcare` tables, and the verified synthetic
  projection (100,000 customers, 75,000 patient profiles, 10,000 public RAG
  rows, and 830 patient-chat rows). The writer-locked reconciliation was
  applied once and its contract/canaries passed. The hosted AI process ingests
  only Spring's public operational catalog into an ephemeral memory index;
  Supabase patient-chat/durable-RAG consumers remain disabled. The exact Render
  catalog rollback capsule is
  [`infrastructure/database/seed-hosted-catalog-rollback.sql`](infrastructure/database/seed-hosted-catalog-rollback.sql)
  and the Supabase compensating capsule remains unexecuted recovery evidence.

For the exact settings, rollback gates, Docker recovery procedure, and the
current PASS/HOLD/NOT_RUN matrix, see
[docs/deployment-beta.md](docs/deployment-beta.md) and
[docs/LOCAL_RUNBOOK.md](docs/LOCAL_RUNBOOK.md).

## Monorepo Layout

```text
apps/backend      Spring Boot 3 backend baseline
apps/frontend     Next.js TypeScript frontend baseline
apps/ai-service   FastAPI AI/RAG service with deterministic fallback
docs/adr          Architecture decision records
docs/architecture Architecture notes and diagrams
infrastructure    Local development infrastructure
plans             AgentKit implementation plans
```

## Local Prerequisites

- Git
- Java 21 for the backend target runtime
- Maven 3.9+
- Node.js 22-24 and npm 10-11 (the frontend package enforces this tested range)
- Python 3.12+
- Docker for local infrastructure

This machine currently has a newer Java runtime than the backend target. The backend is configured for Java 21 compatibility.

## Environment

Copy `.env.example` to `.env` for local use and replace placeholder values. Never commit `.env` or real credentials.

## Commands

Backend (local profile uses PostgreSQL on `localhost:5434` and MinIO on `localhost:9000`):

```bash
cd apps/backend
./mvnw test
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Frontend:

```bash
cd apps/frontend
npm ci
npm run verify
npm run test:e2e
npm run dev
```

AI service:

```bash
cd apps/ai-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .
.venv\Scripts\mypy
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Local infrastructure:

```bash
docker compose --env-file .env -f infrastructure/docker-compose.yml config
docker compose --env-file .env -f infrastructure/docker-compose.yml up
```

Pass the root `.env` explicitly: Compose resolves its implicit project
directory from `infrastructure/`, while the required local secrets live in the
repository-root `.env`. Keeping the required variables fail-closed is
intentional.

For the Windows setup, local demo accounts, health checks, and troubleshooting,
see [docs/LOCAL_RUNBOOK.md](docs/LOCAL_RUNBOOK.md).

On Windows, use the repository safe launcher and keep a single Docker host
owner during recovery. It serializes stop/start operations, bounds the Docker
CLI stop call when a broken AF_UNIX socket would otherwise hang, fails closed
when the Docker host drive has less than 2 GiB free, and preserves images,
volumes, VHDX data, other WSL distributions, and Hibernate.

Keep only one startup/recovery owner. If an older workaround left a scheduled
task named `Docker Desktop socket recovery`, disable that task before enabling
the repository launcher; running both owners at logon races while they rotate
the same AF_UNIX sockets and can surface the misleading “unexpected error”
dialog (including `WSL_E_USER_VHD_ALREADY_ATTACHED`). The change is reversible:

```powershell
$legacyTask = Get-ScheduledTask -TaskName 'Docker Desktop socket recovery' -ErrorAction SilentlyContinue
if ($legacyTask) { Disable-ScheduledTask -TaskName $legacyTask.TaskName }
# To restore the old task deliberately: Enable-ScheduledTask -TaskName 'Docker Desktop socket recovery'
```

Do not delete the individual `dockerInference`, `sailor-ingest.sock`, or
`docker-secrets-engine\engine.sock` entries while Docker is running. Windows
represents active AF_UNIX listeners as reparse points; the safe launcher rotates
only the exact parent directories after Docker is quiescent and keeps each old
directory as a rollback quarantine. Verify recovery with
`docker desktop status`, `docker version`, and `wsl.exe --list --verbose`.

After Docker Desktop is ready, Windows users can build, seed, and run the
automated role-based smoke verification with the command below. If `.env` is
missing, the helper creates it with random disposable JWT/AI/RAG secrets.

```powershell
.\scripts\start-and-verify-local-mvp.ps1
```

Compose requires a non-empty `AI_SERVICE_TOKEN`; set it in the local `.env` before
running the stack. The checked-in defaults are for disposable local development
only, and a successful `config` or local health check does not prove a deployed
or multi-instance environment.

The Compose backend connects to MinIO at `http://minio:9000`; local host runs use
`http://localhost:9000`. Keep `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` aligned
with the backend's `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` values and replace all
example credentials before any shared or deployed use. The unauthenticated local
escape hatch is only for a bare local process with the explicit local runtime
flags.

## Frontend Design Direction

The frontend baseline uses a refined clinical network direction: deep teal, soft mint, warm sand, calm ink, restrained amber, Vietnamese-safe typography, and an appointment-oriented care rail.

`https://hoanmy.com/` is used only as structural healthcare UX inspiration: appointment CTA, specialties, packages, doctors, network/contact, and health content. Do not copy Hoan My logos, brand names, photos, doctors, addresses, phone numbers, package names, news titles, medical claims, colors, or proprietary assets.

Google Stitch may be used for static design concepts only when API, dependencies, and quota are available. If Stitch is unavailable, record it as `NOT_RUN` and continue with the text-based AgentKit frontend design workflow.

## Security Rules

- Do not commit real secrets.
- Keep `.env.example` placeholder-only.
- Add `.gitignore` before generating dependencies or local service data.
- Report secret presence as `present` or `missing`; never print values.

## MVP workflows

- Patient: register/login, book/confirm/look up/cancel/reschedule, maintain profile, read reminders, records, prescriptions and protected diagnostic files.
- Doctor: view assigned daily appointments, check in/start/no-show, create the clinical record that completes a visit, upload and publish diagnostic results.
- Admin: inspect operational appointments and manage doctors, specialties, branches, services, packages, FAQs, articles, live CMS content, recurring schedules and schedule exceptions.
- AI: authenticated specialty triage and semantic retrieval with bounded inputs, explicit citations/provenance, protected ingest and production fail-closed behavior.

## Scope Boundaries

The MVP domain is implemented locally. This repository is not a certified medical
device or a production hospital system. Production adoption still requires a
real secrets manager, TLS/ingress, durable multi-instance RAG persistence,
observability and alerting, backups with restore drills, load testing, security
review, privacy/compliance review, and operational ownership.

The implementation status and production-only gates are tracked in
`docs/PROJECT_PLAN.md`; local MVP completion must not be interpreted as medical,
privacy, security, or operational certification.
