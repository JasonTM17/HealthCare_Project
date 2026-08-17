# HealthCare_Project

HealthCare_Project is a healthcare platform foundation for a Vietnamese hospital-style experience. It is an educational/local-development project; passing local checks does not establish production healthcare, compliance, or deployment readiness.

## Status

The repository currently has auth/RBAC, appointment booking, a clinical records authorization overlay, hospital content APIs, a frontend catalog, a doctor-management admin slice, MinIO file storage baseline, and CI definitions. The repository is on `main`; local changes may still be uncommitted and nothing is claimed as pushed or production-ready.

## Monorepo Layout

```text
apps/backend      Spring Boot 3 backend baseline
apps/frontend     Next.js TypeScript frontend baseline
apps/ai-service   FastAPI AI service baseline without provider calls
docs/adr          Architecture decision records
docs/architecture Architecture notes and diagrams
infrastructure    Local development infrastructure
plans             AgentKit implementation plans
```

## Local Prerequisites

- Git
- Java 21 for the backend target runtime
- Maven 3.9+
- Node.js 22+ and npm
- Python 3.12+
- Docker for local infrastructure

This machine currently has a newer Java runtime than the backend target. The backend is configured for Java 21 compatibility.

## Environment

Copy `.env.example` to `.env` for local use and replace placeholder values. Never commit `.env` or real credentials.

## Commands

Backend (local profile uses PostgreSQL on `localhost:5433` and MinIO on `localhost:9000`):

```bash
cd apps/backend
mvn test
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Frontend:

```bash
cd apps/frontend
npm install
npm run lint
npm run typecheck
npm run test
npm run build
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

The Compose backend connects to MinIO at `http://minio:9000`; local host runs use
`http://localhost:9000`. Keep `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` aligned
with the backend's `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` values and replace all
example credentials before any shared or deployed use.

## Frontend Design Direction

The frontend baseline uses a refined clinical network direction: deep teal, soft mint, warm sand, calm ink, restrained amber, Vietnamese-safe typography, and an appointment-oriented care rail.

`https://hoanmy.com/` is used only as structural healthcare UX inspiration: appointment CTA, specialties, packages, doctors, network/contact, and health content. Do not copy Hoan My logos, brand names, photos, doctors, addresses, phone numbers, package names, news titles, medical claims, colors, or proprietary assets.

Google Stitch may be used for static design concepts only when API, dependencies, and quota are available. If Stitch is unavailable, record it as `NOT_RUN` and continue with the text-based AgentKit frontend design workflow.

## Security Rules

- Do not commit real secrets.
- Keep `.env.example` placeholder-only.
- Add `.gitignore` before generating dependencies or local service data.
- Report secret presence as `present` or `missing`; never print values.

## Scope Boundaries

The foundation and public hospital domain are implemented locally: auth/RBAC,
JWT access+refresh tokens, appointment booking, clinical records authorization,
hospital content APIs, frontend catalog, CI, and the current admin/storage
baselines. Remaining work includes broader scheduling/concurrency, patient and
doctor portals, complete file metadata/ownership hardening, notifications,
AI/RAG/recommendations, semantic search, security hardening, performance, UX
polish, and the final end-to-end demo.

Remaining PROJECT_PLAN.md phases (5-21): admin CMS, doctor scheduling, appointment concurrency, patient/doctor portals, files, notifications, AI foundation/RAG/recommendations, semantic search, security hardening, performance, UX polish, and CI/CD.
