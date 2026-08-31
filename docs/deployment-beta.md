# Synthetic beta deployment runbook

This repository ships a synthetic beta only. The selected hosted topology is
**Render Free + Supabase Free + Vercel**; it is not a production healthcare or
compliance approval and must not receive real patient traffic.

## Canonical Free topology

The canonical Render Blueprint is render.yaml. It provisions only:

| Resource | Plan | Purpose |
| --- | --- | --- |
| healthcare-beta-postgres | Render Free PostgreSQL 16, Singapore | Spring transactional database |
| healthcare-beta-redis | Render Free Key Value, Singapore | Rate-limit/realtime cache; ephemeral |
| healthcare-beta-backend | Render Free image web service, Singapore | Spring API behind the Vercel BFF |

render-free-beta.yaml is a validation copy of the canonical manifest. Both files
must stay equivalent after YAML parsing; Render Blueprint discovery uses
render.yaml.

AI/FastAPI, ClamAV, attachment scanning, object storage, mail, payment,
consultation uploads, remote AI, RAG ingestion and patient-chat consumers are
explicitly disabled in this Free beta. No paid/private Render service is
silently substituted, and no local Docker image is pulled to support it.

Provider credentials stay in Render/Vercel/Supabase secret stores. Never commit
or print a database password, BFF token, JWT secret, Supabase DB URL, or API key.

## Current observed hosted snapshot (2026-08-31)

Refresh this section after every release push; deployment IDs are evidence, not
configuration:

- Vercel stable alias https://healthcare-two-olive.vercel.app is
  Production/READY/PROMOTED at deployment
  `dpl_o1ddh17yfggA7HsmxEFJiMCXe8m3`. Authenticated deployment metadata reports
  source SHA `7a083ab06557225077694a0b2b93e31b89d0c32e`; it was created from a
  clean checkout with the CLI. Catalog BFF probes returned HTTP 200 with
  totals 30 specialties, 475 active doctors and 20 branches. A disallowed
  Origin returned HTTP 403 `BFF_ORIGIN_INVALID` without an allow-origin
  header. `/api/v1/health` returned the intentional HTTP 503 `degraded`
  response because AI is off.
- Render workspace tea-d7ev54q8qa3s7382ljcg has PostgreSQL
  dpg-da7r3uou01pc73boask0-a, Key Value red-daa3ub9f2nfc73956660, and web
  service srv-daa41a9f2nfc7395eg1g. The current live deploy is
  `dep-daaidvp42hec73aj9080`, using requested image digest
  `sha256:c492898b8767119ab9417b55833b473aca65262f21ba713a77e51a972553dcf3`
  and resolved manifest digest
  `sha256:15923632b9303225e65fa67b18cf7900c0f81500452424c1dea9f313dde3c270`.
  `/actuator/health`, `/actuator/health/readiness` and
  `/actuator/health/liveness` returned HTTP 200/`UP`; the short `/readiness`
  and `/liveness` aliases correctly require authentication and return HTTP 401
  without credentials. Render initially had to rediscover the platform port;
  the final app log confirms Spring and Render both use port 10000.
- Render PostgreSQL contains only the deterministic public catalog: 30
  specialties, 20 branches, 500 doctors, 200 services, 100 packages, 500
  articles, 150 raw FAQs, 1,251 doctor-specialty links, 751 doctor-branch
  links, 7,130 schedules and 5 CMS slots. Public filters expose 192 services,
  95 packages, 467 articles and 0 FAQs because FAQ visibility requires a valid
  active-doctor clinical approval; the seed deliberately does not fabricate
  approvals. Customer, patient, appointment and clinical consumer tables
  remain empty. The PostgreSQL external allowlist is empty.
  Render Free PostgreSQL is time-limited and has no provider PITR or backup
  guarantee; Free Key Value is ephemeral.
- Supabase project awaknzhadjglbfkhigck is on Free with eight audited provider
  migration rows, 15 RLS-enabled healthcare tables, 100,000 synthetic
  customers, 75,000 profiles, 10,000 public RAG rows and 830 chat-projection
  rows. The writer-locked reconciliation and hosted canaries passed once;
  ingestion and patient-chat consumers remain disabled. Its exact compensating
  rollback capsule is
  supabase/reconciliation/free-plan-rollback-writer-lock-20260830.sql and is
  intentionally unexecuted.

The promoted Render image is the immutable artifact produced from application source
`7a083ab06557225077694a0b2b93e31b89d0c32e`:

    ghcr.io/jasontm17/healthcare-project-backend@sha256:c492898b8767119ab9417b55833b473aca65262f21ba713a77e51a972553dcf3

The image publish workflow run is
https://github.com/JasonTM17/HealthCare_Project/actions/runs/33365774241 and
the verified database fixture is
`ghcr.io/jasontm17/healthcare-project-database@sha256:d3863eef07879b2fe46ac56636c2908c68d2619be5790f40af7fb522ea7da044`.
The operator workstation never builds or pulls these images.

## Vercel configuration

Set the project root to apps/frontend, install with npm ci, and build with npm
run build. Only these BFF variables are server-side:

- BACKEND_INTERNAL_URL: the HTTPS Render backend URL.
- BFF_PUBLIC_ORIGIN: the exact HTTPS Vercel origin, with no path/query.
- BACKEND_BFF_SERVICE_TOKEN: a random secret shared exactly with Render.

Do not rename these to NEXT_PUBLIC_*. Keep NEXT_PUBLIC_SITE_URL and
NEXT_PUBLIC_ALLOW_INDEXING limited to public metadata. The BFF forwards only the
closed session/CSRF cookie and header set. Missing or mismatched values must
fail closed with 503 BFF_CONFIGURATION_UNAVAILABLE; an untrusted Origin must
fail with 403 BFF_ORIGIN_INVALID.

After a Vercel exact-SHA deploy (manual CLI or a provider-confirmed Git
integration deploy), verify the stable alias:

    GET /api/v1/hospital/specialties?page=0&size=3       -> 200, total 30
    GET /api/v1/hospital/doctors?page=0&size=3           -> 200, total 475 active
    GET /api/v1/hospital/branches?page=0&size=3          -> 200, total 20
    GET /api/v1/health                                  -> 503 degraded (AI disabled)
    GET catalog with Origin: https://evil.example        -> 403 BFF_ORIGIN_INVALID

## Render Free procedure

1. Validate both YAML files against the official Render schema. The canonical
   file must contain exactly one Free database, one Free Key Value and one Free
   image web service, with no pserv, worker or cron resource. Validate the exact
   file submitted to the provider through the Render Blueprint validation API
   (https://api-docs.render.com/reference/validate-blueprint) for owner
   tea-d7ev54q8qa3s7382ljcg. Validation is read-only and must report valid=true
   with three resource actions.
2. Verify the existing resource IDs, plan, region, image digest and empty
   database/Key Value allowlists before any update. Never change the immutable
   database name/user to force a replacement.
3. Keep autoDeployTrigger: off while the image is digest-pinned. A Git push
   alone must not redeploy an unreviewed image. After a new exact-SHA image is
   attested, update the digest in a reviewed commit and trigger one deploy; wait
   for the three /actuator/health* probes.
4. Render managed references provide DATABASE_URL, DATABASE_USERNAME,
   DATABASE_PASSWORD and REDIS_URL. Set
   MANAGEMENT_HEALTH_MAIL_ENABLED=false and all optional feature switches
   false. Do not add localhost SMTP, AI, scanner or storage endpoints.
5. Apply Flyway V1--V52 through backend startup, then run
   infrastructure/database/seed-hosted-catalog.sql exactly once against the
   confirmed database. It is transactional, advisory-lock protected,
   idempotent and synthetic-only. Record expected counts/fingerprints before
   enabling any consumer.
6. Keep the database external allowlist empty after the seed. A connection
   failure requiring TLS is a provider access-control signal; do not open
   0.0.0.0/0 as a workaround.

## Supabase Free procedure

The existing Spring/Flyway public schema remains the account and clinical
authority. Supabase owns only the additive healthcare catalog and de-identified
projections. The confirmed target already has the exact eight-row provider
history ending in 20260830143140; do not run wholesale supabase db push, db
reset, or the local seven-migration history against it.

Before any future write, confirm the project ref, take a provider backup when
the plan offers one, inspect migrations/tables/RLS, freeze writers, and create a
new target-specific compensating artifact. On Free there is no PITR, scheduled
backup or development branch, so manual rollback is the accepted residual risk.
The current writer-locked reconciliation, ACL/RLS/count/fingerprint checks and
service-role canaries passed once. Keep RAG_INGEST_ENABLED,
AI_RAG_INGEST_ENABLED and patient-chat consumers false until a new coordinated
release gate is approved.

## Rollback

1. Drain the Vercel beta and keep all remote/clinical/ingestion switches false.
2. For an application failure, redeploy the last known-good immutable image and
   Vercel deployment. The immediate Render rollback target is deploy
   `dep-daahnhks728c738ds6jg` (the prior immutable backend image); verify its
   status and digest before selecting it. Never run an old binary against a
   newer Flyway schema without a compatibility review. For Vercel, use the
   previous `READY` deployment in the project and verify its alias before
   promoting it.
3. For the Render catalog, first confirm all consumer tables are empty and every
   count/fingerprint still matches the exact snapshot. Then run
   infrastructure/database/seed-hosted-catalog-rollback.sql in a maintenance
   window. It takes an exclusive lock, refuses drift/consumer rows, deletes
   only named synthetic catalog rows, and never uses TRUNCATE, CASCADE or
   Flyway-history edits. If any guard fails, stop.
4. For Supabase, use only the exact
   free-plan-rollback-writer-lock-20260830.sql capsule while its eight-row
   history, object/ACL definitions and row fences match. It is compensating
   evidence, not PITR; never reuse it against a drifted target.
5. Re-run Render health, Vercel origin rejection, Supabase RLS/ACL and all
   catalog count checks after recovery. Keep real-patient traffic disabled.

## Local release gates

With a temporary directory that has enough space:

    python -m pytest -q infrastructure/tests
    python -m pytest -q supabase/tests
    cd apps/frontend
    npm ci --dry-run --ignore-scripts --no-audit --no-fund
    npm audit --package-lock-only --audit-level=moderate
    npm run lint
    npm run typecheck
    npm test
    npm run build

When C: is constrained, set TEMP and TMP to a bounded directory on D: before
frontend commands. Do not start Compose, pull Docker images, or delete
Docker/IDE/Codex data as part of this release gate. Hibernate must remain
enabled. Local gates prove source integrity only; they do not prove provider
backup/restore, clinical compliance, or production cutover.
