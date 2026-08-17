# Foundation Architecture

## Services

- `apps/backend`: Spring Boot modular-monolith API boundary for auth/RBAC,
  appointments, hospital catalog, clinical records, notifications, storage,
  and the authenticated AI gateway.
- `apps/frontend`: Next.js patient/admin-facing web shell. Static seed data is
  still used in some homepage/demo flows and must not be presented as live
  hospital metrics.
- `apps/ai-service`: FastAPI triage, provider-neutral chat/embedding contracts,
  normalized active-content RAG, structured specialty recommendation, and
  bounded hybrid semantic search with explicit provenance. Deterministic local
  fallback is limited to local/demo/test runtimes; non-local remote-provider
  failures are fail-closed. Remote calls were not exercised against a live
  provider in local verification.

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
  slot creation validates doctor status and schedule alignment, uses
  transaction-scoped PostgreSQL advisory locking, and has pending/active-slot
  uniqueness plus interval exclusion invariants with expired-hold cleanup.
- The AI gateway is authenticated at the backend boundary. A shared,
  non-empty `AI_SERVICE_TOKEN` protects direct FastAPI routes, including AI
  health, and is required by Compose, staging, and non-local runtimes. A bare
  local process may opt in to unauthenticated development only with the
  explicit local runtime escape hatch; this is not a production or Compose
  mode. Compose sends the token in its AI healthcheck, and the backend health
  endpoint returns `503` when the AI token is rejected or AI readiness is false.
- RAG ingestion is disabled by default and requires a configured token when
  enabled. Only active and published content is searchable; ingestion strips
  HTML to visible text, reuses embeddings by content hash, retains embedding
  model/provenance, rejects mixed vector contracts, and bounds the in-memory
  document count. It returns source identity citations. The in-memory index is
  a foundation implementation, not a durable production knowledge store.
- Provider calls use explicit input bounds, no automatic retries, and bounded
  timeouts. Remote recommendation output is schema-validated against the
  allow-listed specialty/urgency contract; doctor, schedule, availability, and
  URL values remain backend-owned.
- AI readiness is truthful: the AI service returns HTTP 503 for missing
  service authentication or an unconfigured selected remote provider, and the
  backend gateway forwards its service token and requires an explicit `ok` plus
  `ready: true` health JSON status. The internal search hop uses POST and the
  Uvicorn container disables access logs; public/proxy GET query logging remains
  an operational configuration limitation. Configured remote providers are
  explicitly fail-closed at readiness (`remote_probe_required: true`) because
  this slice performs no live provider liveness probe.

## Current Non-Goals

- No production deployment, compliance certification, or real patient data.
- No claim of live CI, live provider execution, or cross-platform runtime
  support from local tests alone.
- Broader patient/doctor portals, clinical file metadata/linkage, AI rate
  limiting, durable pgvector storage, live provider verification, and
  end-to-end demo polish remain future work.
- The current scope is one fictional hospital and its public catalog. There is
  no tenant isolation or multi-hospital data model. RAG citations are indexed
  identities only, not authoritative clinical source URLs.
