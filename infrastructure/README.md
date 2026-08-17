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
