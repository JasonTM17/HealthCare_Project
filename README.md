# HealthCare_Project

HealthCare_Project is a healthcare platform foundation for a Vietnamese hospital-style experience. The current objective is a clean monorepo baseline, not production healthcare features.

## Status

Foundation work is complete through the public hospital domain (Phase 4). The monorepo has a working auth/RBAC system, appointment booking engine, clinical records overlay, hospital content APIs, a polished frontend catalog, and CI. The repository is on `main`, unpushed.

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

Backend (local profile uses PostgreSQL on `localhost:5433`):

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

The foundation (Phases 1-5) and public hospital domain (Phase 4) are complete: auth/RBAC, JWT access+refresh tokens, appointment booking, clinical records, hospital content APIs, frontend catalog, and CI.

Remaining PROJECT_PLAN.md phases (5-21): admin CMS, doctor scheduling, appointment concurrency, patient/doctor portals, files, notifications, AI foundation/RAG/recommendations, semantic search, security hardening, performance, UX polish, and CI/CD.
