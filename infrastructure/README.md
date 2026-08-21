# Infrastructure

Local development infrastructure for HealthCare_Project. This is not production deployment configuration.

Copy the root `.env.example` to `.env` and replace its local-only placeholders before running the complete stack:

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

Compose uses tracked local-only fallbacks for the AI and JWT boundaries when
their variables are empty, so a fresh local stack is reproducible:
`local-development-token-not-for-production` and
`local-jwt-secret-not-for-production`. Replace both with private values before
any shared or non-demo run; the local bare-process escape hatch does not apply
to Compose.

The local Compose booking journey defaults `APP_BOOKING_ALLOW_TEST_OTP=true`
because this repository does not include an SMS provider; use `123456` only in
the local demo. Set it to `false` before any non-demo deployment and connect a
real OTP delivery provider.

The local stack exposes frontend on port 3000, backend on 8080, AI service on
8000, PostgreSQL on host port 5434 (container port 5432), Redis on 6379, and
MinIO on 9000 (console 9001). Override `FRONTEND_HOST_PORT`,
`BACKEND_HOST_PORT`, `AI_SERVICE_HOST_PORT`, `POSTGRES_HOST_PORT`,
`REDIS_HOST_PORT`, `MINIO_API_HOST_PORT`, and `MINIO_CONSOLE_HOST_PORT` for an
isolated local run when another worktree or stack already owns the defaults.
Compose container and volume names stay project-scoped; do not add fixed
`container_name` values when collecting runtime proof from multiple worktrees.

The local seed includes the fictional ADMIN fixture `admin@healthcare.local`
with the documented local demo password from `docs/LOCAL_RUNBOOK.md` so the CMS
publish-to-user flow can be tested.
This credential is local-only and must be replaced/disabled before any shared or
non-demo deployment.

The `local-seed` one-shot service waits for the backend health check (after
Flyway), runs the backward-compatible base seed, then applies the V15 rich
content overlay for the Stitch detail screens. The schema also includes V16
CMS audit snapshots, V17 published-article guards, V18 hashed appointment OTP
storage, V19 secure file metadata, V20 appointment reminder delivery, V21
patient profile details, V22 careers and job applications, V23 public CMS
slot-key constraints, and V24 CMS slot/component constraints shared with the
admin editor. The overlay only fills empty new fields, so rerunning it does not
overwrite admin edits. It defaults to
`apps/backend/src/main/resources/db/seed/seed-local-data.sql`; set the
PowerShell `SEED_FILE` environment variable for one run if the larger seed is
needed. See `docs/architecture/cms-realtime.md` for the rerun/query proof.

The large fixture also creates recurring Monday-Friday morning and afternoon
doctor schedules, so branch-aware booking remains executable while pagination
and search are exercised.

## Large database fixture

The tracked `seed-large-data.sql` is a generator of fictional local-development
data, not a production dump or real patient data. A clean PostgreSQL 16 run
produces approximately 14,000 rows across the hospital, scheduling, identity,
and clinical tables, including 500 doctors, 200 services, 100 packages, 500
articles, 1,001 users (1,000 synthetic users plus the local CMS admin), about
7,500 recurring doctor schedules, and 450
prescription items. Relationship links use stable hash ordering, so a clean
replay produces the same identities and relationship counts.

Use the larger dataset with the existing Flyway-managed local stack:

```powershell
$env:SEED_FILE = "../apps/backend/src/main/resources/db/seed/seed-large-data.sql"
docker compose -f infrastructure/docker-compose.yml up --build
```

The release workflow also publishes a standalone GHCR image at
`ghcr.io/jasontm17/healthcare-project-database`. It applies the migrations in
Flyway order and then loads the large seed plus the careers fixture when
PostgreSQL initializes a new data directory. Prefer the immutable
`sha-<verified-commit>` tag shown in the successful
`Publish database package` workflow run; semantic release tags are convenient
aliases and should be checked with `docker buildx imagetools inspect` before
use:

```bash
docker run --name healthcare-database \
  -e POSTGRES_DB=healthcare \
  -e POSTGRES_USER=healthcare \
  -e POSTGRES_PASSWORD=change-me \
  -p 5435:5432 \
  ghcr.io/jasontm17/healthcare-project-database:sha-<verified-commit>
```

This fixture intentionally does not create `flyway_schema_history`; use it as
a standalone seeded database for exploration and performance checks, or use
the Compose stack when the Spring Boot backend should own Flyway migrations.
