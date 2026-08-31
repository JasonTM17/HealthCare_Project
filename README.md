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

This is an evidence record for the current synthetic beta, not a production
readiness or healthcare-compliance claim. The integration target is `main`.
The previous hosted checkpoint was inspected at
`10b22040fd113c2addf679f0f10c36aabeaac1fa`, and the hosted-promotion record
was materially updated at `836f8b35a1a17dfad675cb5ae2f54b7ec57d127b`.
Later documentation-only corrections do not change the hosted payload: verify
the current `main` tip with `git rev-parse main` and its exact completed CI run
instead of hardcoding a self-referential tip here. The application/release
source used by the hosted beta is
`7a083ab06557225077694a0b2b93e31b89d0c32e`. Always bind a release to
`git rev-parse HEAD` plus the application source SHA and immutable image digest,
not to `latest` or to a deployment label.

- GitHub CI run [33365515571](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33365515571) passed all six jobs for `7a083ab06557225077694a0b2b93e31b89d0c32e` (frontend browser gate: 34 tests).
- The first image publication attempt [33365399607](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33365399607) correctly failed on an invalid Dockerfile `CMD-SHELL` token. Commit `7a083ab` changed it to Dockerfile shell-form `CMD`; the succeeding [image run 33365774241](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33365774241) passed all four image jobs.
- The verified [database package run 33365776484](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33365776484) passed with SBOM and provenance. All references below use the immutable `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` audit tag.

The hosted beta deliberately uses only Render Free resources; `render.yaml` is
the canonical manifest and `render-free-beta.yaml` is a parity copy for review.
The local-only FastAPI service is provisioned as a native Python Free web
service for authenticated hospital-support chat and public-catalog RAG. Remote
patient/clinical AI, ClamAV, attachment scanning, object storage, mail and
payment consumers remain fail-closed. The backend image is published from the
exact application source SHA above and is promoted only after the digest pin
and deploy health gates pass.

| GHCR package | Immutable reference | Audit tag |
| --- | --- | --- |
| [backend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-backend) | `ghcr.io/jasontm17/healthcare-project-backend@sha256:c492898b8767119ab9417b55833b473aca65262f21ba713a77e51a972553dcf3` | `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` |
| [AI service](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-ai-service) | `ghcr.io/jasontm17/healthcare-project-ai-service@sha256:157a3f5be8c9693619401df33d3cc2f616b0172f2a8a53a5a8fb20eb380fe691` | `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` |
| [attachment scanner](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-attachment-scanner) | `ghcr.io/jasontm17/healthcare-project-attachment-scanner@sha256:535c9437ed3b49577d77aaf6f7ebb2841e69bca49f0db7b2d749565b86a20b02` | `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` |
| [frontend](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-frontend) | `ghcr.io/jasontm17/healthcare-project-frontend@sha256:640d3b5eda3201e43b3493f70f35007c4822a76aa73e811bd8840b8aab532a1e` | `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` |
| [database fixture](https://github.com/JasonTM17/HealthCare_Project/pkgs/container/healthcare-project-database) | `ghcr.io/jasontm17/healthcare-project-database@sha256:d3863eef07879b2fe46ac56636c2908c68d2619be5790f40af7fb522ea7da044` | `sha-7a083ab06557225077694a0b2b93e31b89d0c32e` |

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

On 2026-08-30, `npm ci --dry-run --ignore-scripts --no-audit --no-fund`, the
manifest/lockfile synchronization check, and `npm audit --package-lock-only`
all passed; the audit reported zero vulnerabilities. `npm outdated` reports
only major upgrade lines (ESLint 10, Tailwind CSS 4, and TypeScript 7), which
remain deliberately deferred until a separate compatibility review.

- Vercel's stable [beta alias](https://healthcare-two-olive.vercel.app) is
  Production/READY at deployment `dpl_o1ddh17yfggA7HsmxEFJiMCXe8m3`,
  PROMOTED and manually deployed from a clean checkout of application SHA
  `7a083ab06557225077694a0b2b93e31b89d0c32e`. The deployment metadata reports
  the same source SHA and the alias serves the verified BFF. Do not infer an
  automatic Git integration deploy; repeat the exact-SHA CLI deploy after an
  application change. The three BFF variables remain server-only
  (`BACKEND_INTERNAL_URL`, `BFF_PUBLIC_ORIGIN`, and
  `BACKEND_BFF_SERVICE_TOKEN`). The BFF health route becomes healthy only when
  both the Spring service and its authenticated AI dependency are ready; Free
  service cold starts can make the first request slow.
- Render has a Free Singapore PostgreSQL (`dpg-da7r3uou01pc73boask0-a`), Free
  Key Value (`red-daa3ub9f2nfc73956660`), Free image-backed Spring web service
  (`srv-daa41a9f2nfc7395eg1g`), and Free native-Python AI web service
  (`srv-daal7kgn74is73bafjqg`). The AI deploy
  `dep-daal7l8n74is73baflo0` is live with authenticated `/health`, local
  provider/embeddings, and remote-patient flags disabled. Backend deploy
  `dep-daaidvp42hec73aj9080` is `live` with requested image digest
  `sha256:c492898b8767119ab9417b55833b473aca65262f21ba713a77e51a972553dcf3`
  and Render-resolved manifest digest
  `sha256:15923632b9303225e65fa67b18cf7900c0f81500452424c1dea9f313dde3c270`.
  `/actuator/health`, `/actuator/health/liveness` and
  `/actuator/health/readiness` returned HTTP 200/`UP`; unauthenticated short
  `/readiness` and `/liveness` returned 401. The previous known-good rollback
  deploy is `dep-daahnhks728c738ds6jg` on the prior immutable image.
  The hosted synthetic catalog contains 30 specialties, 20 branches, 500
  doctors, 200 services, 100 packages, 500
  articles, 150 raw FAQs, 1,251 doctor-specialty links, 751 doctor-branch
  links, 7,130 schedules, and 5 CMS slots. Public filters expose 192 services,
  95 packages, 467 articles and 0 FAQs because FAQ visibility requires a valid
  active-doctor clinical approval; the seed does not fabricate approvals.
  External PostgreSQL access is closed (`ipAllowList=[]`). The Free database
  expires after its provider retention window and has no provider backup/PITR
  guarantee; Key Value is ephemeral.
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
owner during recovery. It serializes stop/start operations, fails closed when
the Docker host drive has less than 2 GiB free, and preserves images, volumes,
VHDX data, other WSL distributions, and Hibernate.

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
