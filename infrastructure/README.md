# Infrastructure

Local development infrastructure for HealthCare_Project. This is not production deployment configuration.

Copy the root `.env.example` to `.env` and replace its local-only placeholders before running the complete stack:

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

Compose is fail-closed for the internal AI boundary. Set a non-empty shared
`AI_SERVICE_TOKEN` in `.env`; the local bare-process escape hatch does not
apply to Compose.

The local stack exposes frontend on port 3000, backend on 8080, AI service on 8000, PostgreSQL on host port 5434 (container port 5432), Redis on 6379, and MinIO on 9000 (console 9001).

The `local-seed` one-shot service waits for the backend health check (after
Flyway) and runs the fictional PostgreSQL seed once. It defaults to
`apps/backend/src/main/resources/db/seed/seed-local-data.sql`; set the
PowerShell `SEED_FILE` environment variable for one run if the larger seed is
needed. See `docs/architecture/cms-realtime.md` for the rerun/query proof.
