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

## CMS and account compatibility

The selected hosted backend is `https://healthcare-backup-backend.onrender.com`
in the user-selected Render workspace. Its AI dependency is
`https://healthcare-backup-ai.onrender.com`. Set Vercel's server-only
`BACKEND_INTERNAL_URL` to this backend and keep the BFF service token aligned
with that service's secret store. Remove retired-cluster `BACKEND_BACKUP_URL`
and `BACKEND_FALLBACK_URL` entries. A deployment without an explicitly configured
alternate retries only its selected backend; it does not select another cluster.
Project environment changes require a new frontend deployment. Record and
verify the effective deployment, rather than inferring it from variable names.

Deploy the compatible backend and apply its additive migrations before
enabling the frontend editor/account consumers. The schema owners are
[private drafts and page layouts](../apps/backend/src/main/resources/db/migration/V119__cms_private_drafts_and_page_layout.sql)
and [the credential epoch](../apps/backend/src/main/resources/db/migration/V120__user_security_version.sql).
Once `PAGE_LAYOUT` data exists, keep every CMS writer layout-aware; a mixed
writer fleet or an older backend is not an assumed rollback target.

Recover the frontend to a prior compatible deployment while retaining the
compatible backend and additive data. A backend rollback requires explicit
compatibility proof for persisted layouts and credential epochs. Do not
down-migrate, reset epochs, or remove draft/history data as an automatic
rollback. See [CMS editorial boundaries](architecture/cms-realtime.md) and
[authentication rationale](adr/ADR-002-authentication-strategy.md).

Account verification/password-reset responses describe a mail request, not
delivery. Preserve the distinction until actual SMTP/outbox delivery is
observed; source tests and an accepted request cannot establish it.

## Verified synthetic beta

The release-record baseline for local Docker readiness is
`2541663f8ff8cd34c76fe99c0d7acb9d4d420c5c`; CI
[33497889741](https://github.com/JasonTM17/HealthCare_Project/actions/runs/33497889741)
passed all six jobs for the Docker readiness release binding. Its parent
`9f35161d64bfadc9ce816e626880ff7d706f9c68` carries the local Docker readiness
hardening; `2541663f` carries only the documentation binding. Later docs-only
commits may advance the repository tip without changing this baseline. The
hosted
application source identities remain component-specific below because this
tip changes only the local launcher, operational documentation, and tests.
The current hosted backend/AI source overlay is
`01527af607673450cf19d17bee04b4e0ca53bc62`; its exact-source images were
published with SBOM/provenance by the attested workflow recorded in
[deployment-beta.md](deployment-beta.md). The frontend was separately
redeployed from repository commit `2f0911520d44f8c0a18dee69121dfa711188d432`
after the responsive repair. The operator workstation did not build or pull
the release images. Provider runtime bindings can intentionally lag a source
overlay when a component is unchanged; always use the component-level identity
below rather than assuming one SHA for every platform.

- Frontend: [www.healthcare.id.vn](https://www.healthcare.id.vn),
  Vercel deployment `dpl_7LBTguGVawqJdR6v6AFyXzMH6uwU`, `READY`/`PROMOTED`
  production, uploaded from repository commit
  `5d104d974221cddd4cdd19a54ddfbf11b596cae2` after the hero image fallback,
  sticky nav bleed, brand asset, and mobile collision fixes. The stable
  aliases `https://www.healthcare.id.vn` and
  `https://healthcare.id.vn` were verified live (HTTP 200).

  A stateless public-chat canary returned `200 HOSPITAL_SUPPORT /
  local_fallback / ANSWER` for a benign support question and `200 / REFUSE`
  for a request to access another patient's records; an untrusted origin was
  rejected with `403 BFF_ORIGIN_INVALID`, and blank input with
  `400 VALIDATION_ERROR`. Persisted authenticated SSE remains a separate gate.
  Server-only variables are `BACKEND_INTERNAL_URL`,
  `BFF_PUBLIC_ORIGIN`, and `BACKEND_BFF_SERVICE_TOKEN`; keep their values in
  Vercel's encrypted environment store.
- Backend: [healthcare-beta-backend.onrender.com](https://healthcare-beta-backend.onrender.com),
  Render Free service `srv-daa41a9f2nfc7395eg1g`, live deploy
  `dep-dabgeaqjnfac73al6qgg`, pinned to the immutable backend image reference
  recorded in `README.md` and `docs/deployment-beta.md` (resolved platform
  digest `sha256:16d01d2babcb143c0268f15fa3166e8ebefcd571780067f72749e2470c25d847`).
  `/actuator/health` returned `200 UP` after the Free cold start.
- AI: [healthcare-beta-ai.onrender.com](https://healthcare-beta-ai.onrender.com),
  Render Free service `srv-daal7kgn74is73bafjqg`, exact-source live deploy
  `dep-daba3ortqb8s73f9kcug` at source `01527af`. `/livez` returned HTTP 200;
  provider and embeddings remain local fallback, and remote clinical/patient AI
  is off. A coordinated restart briefly produced backend `502` calls while the
  Free AI process was still booting; the AI instance then became ready at
  `02:09:54Z`, with no subsequent token-rejection, OOM or fatal-restart signal
  in the observed window. Render Free startup ordering remains an availability
  limitation, not a credential or Docker corruption signal.
- Database: Render Free PostgreSQL remains the Spring/Flyway authority. The
  Supabase Free project holds only the additive `healthcare` projection and
  its eight audited migration rows; consumers remain fail-closed.

Rollback is digest-based: the historical Render candidates
`dep-daaq5hp5efls73b4o2jg` and `dep-dabeuclg1s2s73cg6pd0` are deactivated, so
neither is a standing rollback target. If rollback is needed, redeploy the
reviewed immutable image reference as a new Render deploy, record its resulting
deploy ID and resolved digest, and re-run health/catalog probes before restoring
traffic. Revert Vercel to a prior `READY` deployment through the project
dashboard/CLI. Supabase rollback is the target-specific capsule documented in
[deployment-beta.md](deployment-beta.md), never a broad reset or
`supabase db push`.
