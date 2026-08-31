# Deployment

## Local Development

```bash
cp .env.example .env
# Replace the local AI/JWT values and set strong local-only values before sharing.
docker compose --env-file .env -f infrastructure/docker-compose.yml up --build
```

The explicit `--env-file .env` is required when running from the repository
root: the Compose file is under `infrastructure/`, but its fail-closed local
secrets are stored in the root environment file.

Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- AI Service: http://localhost:8000
- MinIO Console: http://localhost:9001

For parallel local stacks, override the `*_HOST_PORT` values documented in
`.env.example`. Compose service names, containers, and volumes are project
scoped; avoid fixed container names when collecting runtime evidence from more
than one checkout.

## Production Checklist

1. Keep the private production environment outside version control and run
   `.\scripts\validate-production-env.ps1 -EnvFile <private-path>`.
2. Store JWT, database, MinIO, SMTP, AI, RAG, and payment webhook secrets in a
   deployment secret manager; rotate credentials exposed during setup.
3. Terminate TLS with a real domain/certificate and allow only explicit HTTPS
   origins in CORS.
4. Keep fixed booking OTP disabled. Verify real SMTP delivery and status email
   delivery without logging OTPs or message bodies.
5. Connect only an authorized provider adapter to the HMAC-signed,
   provider-neutral reconciliation webhook. The project does not directly read
   Vietcombank transactions without such a provider and credentials.
6. Schedule encrypted PostgreSQL and object-storage backups with off-site
   retention. Use `scripts/backup-local-data.ps1` only as the local snapshot
   baseline, then prove recovery in isolated restore drills.
7. Configure monitoring, alerting, audit retention, dependency scanning, and
   incident ownership before accepting real patient or payment data.

The Compose stack is a local development boundary. It is not evidence of
multi-instance CMS fan-out, provider availability, backup/restore, or a
production deployment.
