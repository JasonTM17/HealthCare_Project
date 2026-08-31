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

## Verified synthetic beta

The current application image was built from
`7a083ab06557225077694a0b2b93e31b89d0c32e` and published by the attested
GitHub workflows recorded in [deployment-beta.md](deployment-beta.md). The
operator workstation did not build or pull the image.

- Frontend: [healthcare-two-olive.vercel.app](https://healthcare-two-olive.vercel.app),
  Vercel deployment `dpl_o1ddh17yfggA7HsmxEFJiMCXe8m3`,
  `READY`/`PROMOTED` production, source SHA verified against the application
  commit. Server-only variables are `BACKEND_INTERNAL_URL`,
  `BFF_PUBLIC_ORIGIN`, and `BACKEND_BFF_SERVICE_TOKEN`; keep their values in
  Vercel's encrypted environment store.
- Backend: [healthcare-beta-backend.onrender.com](https://healthcare-beta-backend.onrender.com),
  Render Free service `srv-daa41a9f2nfc7395eg1g`, live deploy
  `dep-daaidvp42hec73aj9080`. `/actuator/health*` returned `200 UP` in the
  post-deploy probe; the short unauthenticated aliases remain `401`.
- Database: Render Free PostgreSQL remains the Spring/Flyway authority. The
  Supabase Free project holds only the additive `healthcare` projection and
  its eight audited migration rows; consumers remain fail-closed.

Rollback is digest-based: restore Render deploy
`dep-daahnhks728c738ds6jg` only after verifying its image digest and then
re-run the health/catalog probes. Revert Vercel to a prior `READY` deployment
through the project dashboard/CLI. Supabase rollback is the target-specific
capsule documented in [deployment-beta.md](deployment-beta.md), never a broad
reset or `supabase db push`.
