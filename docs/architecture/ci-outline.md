# CI Outline

The repository has a committed GitHub Actions workflow at
`.github/workflows/ci.yml`. Its definition is configuration evidence only; no
CI run is claimed in the local handoff.

## Workflow Gates

1. Backend service containers provide PostgreSQL 16 and MinIO. `mvn -B verify`
   runs from `apps/backend` with the CI database variables, so Flyway migration
   tests and the Spring integration suite exercise that PostgreSQL service.
   `TestcontainersIntegrationTest` is currently a backwards-compatible test
   base-class alias; it does not start a Java Testcontainers container.
   Successful verification uploads the generated backend JAR as a short-lived
   CI evidence artifact.
2. Frontend runs install, lint, typecheck, the declared Node test suite, and
   the production build from `apps/frontend`. Successful builds upload `.next`
   as a short-lived CI evidence artifact, not as a production release.
3. AI service installs pinned dependencies and runs Ruff, mypy, and pytest from
   `apps/ai-service`.
4. Infrastructure configuration is validated with
   `docker compose -f infrastructure/docker-compose.yml config --quiet` using
   non-production CI-only placeholder values for the required variables. This
   gate does not build or publish container images.
5. Repository hygiene checks changed-file whitespace and rejects tracked
   environment/private-key files plus a narrow set of credential-shaped token
   formats. Checkout credentials are not persisted into the job worktrees. The
   scan reports file paths only; it must not print secret values.

## Local Evidence Boundary

The current local run observed backend 76/76 tests against disposable
PostgreSQL 16.15 and MinIO services, frontend lint/typecheck/test/build, AI
pytest 23/23 plus Ruff/mypy, and Compose config validation. Flyway applied V1-V9
and Hibernate validation passed. Those are local checks, not evidence of a
GitHub Actions run, deployment, image publication, or production readiness.
The backend integration base uses `TEST_DB_*` to target an external PostgreSQL
service; Java Testcontainers execution is `NOT_RUN` unless a test explicitly
starts a Testcontainers container. Local `actionlint` and `yamllint` were not
available, so YAML parsing was checked with PyYAML instead. Cross-platform local
commands should use the equivalent `mvn`, `npm`, `python -m`, `git`, and
`docker compose` invocations from the repository README; no Windows-specific
shell behavior is required by the workflow gates.
