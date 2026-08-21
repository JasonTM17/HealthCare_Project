# CI Outline

The repository has a committed GitHub Actions workflow at
`.github/workflows/ci.yml`. Its definition is configuration evidence only;
actual run status belongs to the GitHub Actions run for the exact commit under
review.

## Workflow Gates

1. Backend service containers provide PostgreSQL 16 and MinIO. `mvn -B verify`
   runs from `apps/backend` with the CI database variables and an explicit
   cleanup opt-in for the dedicated `healthcare_test` database, so Flyway
   migration tests and the Spring integration suite exercise that PostgreSQL
   service.
   `TestcontainersIntegrationTest` is currently a backwards-compatible test
   base-class alias; it does not start a Java Testcontainers container.
   Successful verification uploads the generated backend JAR as a short-lived
   CI evidence artifact.
2. Frontend runs install, lint, typecheck, the declared Node test suite,
   production build, and a Playwright CMS realtime browser gate from
   `apps/frontend`. The browser gate drives the admin CMS editor and public
   homepage against a mocked backend/SSE contract; it does not replace live
   Compose E2E. Successful builds upload `.next` as a short-lived CI evidence
   artifact, not as a production release. Playwright diagnostics upload only on
   browser-test failure.
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

## Evidence Boundary

Exact test counts and pass/fail status are run evidence, not evergreen
architecture. Treat GitHub Actions, local terminal output, and package
publication logs as the authority for a frozen commit. Green CI is not evidence
of deployment, image publication, compliance, provider liveness, backup/restore,
or production readiness.
The backend integration base uses `TEST_DB_*` to target an external PostgreSQL
service; Java Testcontainers execution is `NOT_RUN` unless a test explicitly
starts a Testcontainers container. Local `actionlint` and `yamllint` were not
available, so YAML parsing was checked with PyYAML instead. Cross-platform local
commands should use the equivalent `mvn`, `npm`, `python -m`, `git`, and
`docker compose` invocations from the repository README; no Windows-specific
shell behavior is required by the workflow gates.
