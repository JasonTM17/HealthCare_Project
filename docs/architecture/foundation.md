# Foundation Architecture

## Services

- `apps/backend`: Spring Boot modular-monolith API boundary.
- `apps/frontend`: Next.js patient/admin-facing web shell.
- `apps/ai-service`: FastAPI AI boundary with provider calls disabled at foundation stage.

## Local Dependencies

- PostgreSQL for transactional data.
- Redis for cache/session-ready infrastructure.
- MinIO-compatible object storage for future medical documents.

## Current Non-Goals

- No production deployment.
- No real authentication or appointment booking.
- No clinical workflow implementation.
- No live AI provider calls.
