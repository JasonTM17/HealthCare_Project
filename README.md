# HealthCare_Project

HealthCare_Project is a healthcare MVP for a Vietnamese hospital-style experience. It is an educational/local-development project; passing local checks does not establish production healthcare, compliance, or deployment readiness.

## Status

The repository currently has auth/RBAC, branch-aware booking and rescheduling, bounded OTP confirmation, appointment lifecycle/reminders, patient and doctor portals, bank-transfer payment reconciliation, authorized clinical records and diagnostic files, complete hospital catalog administration, recurring schedule administration, AI/RAG/search guardrails, MinIO metadata, and CI definitions. Backend, AI, frontend static/typecheck/lint/build, Compose-configuration, database-fixture, and a Playwright CMS realtime browser gate are wired in CI. The browser gate proves the admin-to-public homepage CMS flow against a mocked backend contract; full live Compose browser E2E, backup/restore drills, external AI provider validation, compliance, and production deployment remain separate gates.

## Hosted Beta Release Record

This is an evidence record for the current synthetic beta, not a production
readiness or healthcare-compliance claim. The integration target is `main`.
The current package/application source is
`caedef092c2df9dff1e489b8696d7720817a4928`; the checked-in Render pins and
this record may be committed after that source, but every digest below remains
bound to the exact source SHA. Never replace these references with `latest`.

- GitHub CI run [33310018202](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33310018202) passed all six jobs for the exact package source SHA.
- The follow-up pin/manifest commit `5de6205442597582e76de5c7e6b27c7f94131caf` was independently validated by CI run [33310401105](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33310401105), which passed all six jobs; it does not change the application source or any published digest.
- The [application image publish run 33310156810](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33310156810) passed all four image jobs, and the [database package run 33310158307](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33310158307) passed. Each package below uses the immutable `sha-caedef092c2df9dff1e489b8696d7720817a4928` audit tag and has a verified provenance attestation bound to that source SHA.

| GHCR package | Immutable reference | Audit tag |
| --- | --- | --- |
| [backend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-backend) | `ghcr.io/jasontm17/healthcare-project-backend@sha256:165ae73c81b1236c1e4499c1f75bf50cef2d387e92ef2bf22f95452cf1f8020d` | `sha-caedef092c2df9dff1e489b8696d7720817a4928` |
| [AI service](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-ai-service) | `ghcr.io/jasontm17/healthcare-project-ai-service@sha256:676df026d8f4ecbc8e4e9d70a424a164e8408c3933c324bda972316568bbb68e` | `sha-caedef092c2df9dff1e489b8696d7720817a4928` |
| [attachment scanner](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-attachment-scanner) | `ghcr.io/jasontm17/healthcare-project-attachment-scanner@sha256:7b445d77b20417f4d7921b3914dd3e7f9b054a5f9a7230dc2e87df13f810c9ba` | `sha-caedef092c2df9dff1e489b8696d7720817a4928` |
| [frontend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-frontend) | `ghcr.io/jasontm17/healthcare-project-frontend@sha256:b32ca5fbe572a2b142e50562e81f2176e0b4f1e1c84212d9095ceb33ae1aa5f4` | `sha-caedef092c2df9dff1e489b8696d7720817a4928` |
| [database fixture](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-database) | `ghcr.io/jasontm17/healthcare-project-database@sha256:76d4d7827bb61ca36995ae9119adc151e37f7e2639495bbb204a1f34a54efe5f` | `sha-caedef092c2df9dff1e489b8696d7720817a4928` |

### Frontend package contract

The only npm workspace is `apps/frontend`; `package.json` and
`package-lock.json` are kept in lockfile v3 sync. The release-tested contract
is Node.js `>=22 <25` with npm `>=10 <12`, installed with `npm ci`.

- Runtime pins: Next.js `16.3.3`, React `19.2.8`, and React DOM `19.2.8`.
- Tooling pins: `eslint-config-next` `16.3.3` and TypeScript `6.0.3`; the
  `@playwright/test` range currently resolves to `1.62.1` in the lockfile.
- The local/CI gate is `npm run verify` (lint, typecheck, unit tests, and
  production build), followed by `npm run test:e2e` for the browser gate.

On 2026-08-30, `npm ci --dry-run --ignore-scripts --no-audit --no-fund`, the
manifest/lockfile synchronization check, and `npm audit --package-lock-only`
all passed; the audit reported zero vulnerabilities. `npm outdated` reports
only major upgrade lines (ESLint 10, Tailwind CSS 4, and TypeScript 7), which
remain deliberately deferred until a separate compatibility review.

- Vercel has a `READY` production deployment at [healthcare-two-olive.vercel.app](https://healthcare-two-olive.vercel.app), deployment `dpl_F95VVwT1s9NHZNmPsLcrsHE87R75`, with authenticated metadata `gitCommitSha=caedef092c2df9dff1e489b8696d7720817a4928`. It was submitted from a clean detached source worktree and is aliased to the stable beta domain; twenty public route probes passed with CSP, frame-deny and nosniff headers. The browser BFF probes intentionally return `503 BFF_CONFIGURATION_UNAVAILABLE` until the server-only Render/Vercel variables are configured.
- Render has the free beta PostgreSQL and Redis-compatible resources, but its image-backed application services are still blocked by the provider `need_payment_info` gate. No substitute service or paid upgrade was created.
- Supabase project `awaknzhadjglbfkhigck` is on the Free plan with the reviewed migration history and synthetic counts. The exact reapply gate is read-only green; a fresh guarded write remains HOLD until the manual-rollback/no-PITR boundary is explicitly accepted.

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
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml up
```

For the Windows setup, local demo accounts, health checks, and troubleshooting,
see [docs/LOCAL_RUNBOOK.md](docs/LOCAL_RUNBOOK.md).

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
