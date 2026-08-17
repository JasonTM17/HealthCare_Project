# CI Outline

The repository has a committed GitHub Actions workflow at
`.github/workflows/ci.yml`. Its definition is configuration evidence only; no
CI run is claimed in the local handoff.

## Workflow Gates

1. Backend service containers provide PostgreSQL 16 and MinIO, then
   `mvn -B verify` runs from `apps/backend` with the CI database variables.
2. Frontend runs its package checks from `apps/frontend`.
3. AI service runs its Python checks from `apps/ai-service`.
4. Infrastructure configuration is validated with
   `docker compose -f infrastructure/docker-compose.yml config`.
5. Repository hygiene includes secret-pattern review and `git diff --check`.

## Local Evidence Boundary

The final local run observed backend 58/58 tests against explicitly configured
PostgreSQL 16.15 with MinIO available, frontend lint/typecheck/test/build,
AI pytest/Ruff/mypy, and Compose config validation. The Java Testcontainers
provider was not accepted in this desktop environment, and no CI, deployment,
or production-readiness conclusion follows from the local run.
