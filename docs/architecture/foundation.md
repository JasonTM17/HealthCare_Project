# Foundation Architecture

## Services

- `apps/backend`: Spring Boot modular-monolith API boundary for auth/RBAC,
  appointments, hospital catalog, clinical records, notifications, storage,
  and the authenticated AI gateway.
- `apps/frontend`: Next.js patient/admin-facing web shell. Static seed data is
  still used in some homepage/demo flows and must not be presented as live
  hospital metrics.
- `apps/ai-service`: FastAPI triage, embeddings, RAG, specialty recommendation,
  and semantic-search foundation with deterministic local fallbacks. DeepSeek
  calls are optional and were not exercised in the local verification.

## Local Dependencies

- PostgreSQL for transactional data and Flyway migrations.
- Redis for cache/session-ready infrastructure.
- MinIO-compatible object storage for file upload/download flows.
- The backend AI gateway calls the internal AI service at `/triage` and
  `/recommendations/specialty`; Compose wires this as `AI_SERVICE_URL`.

## Verified Boundaries

- Clinical records require authentication, role checks, linked patient/doctor
  ownership, DTO responses, and negative authorization coverage.
- Appointment lookup/cancellation requires a linked owner or phone proof;
  slot creation uses transaction-scoped PostgreSQL advisory locking plus an
  active-slot uniqueness index.
- RAG ingestion is disabled by default and requires a configured token when
  enabled. The in-memory index is a foundation implementation, not a durable
  production knowledge store.

## Current Non-Goals

- No production deployment, compliance certification, or real patient data.
- No claim of live CI, live provider execution, or cross-platform runtime
  support from local tests alone.
- Broader patient/doctor portals, clinical file metadata/linkage, rate limits,
  durable pgvector storage, and end-to-end demo polish remain future work.
