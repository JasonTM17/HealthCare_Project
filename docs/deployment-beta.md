# Synthetic beta deployment runbook

The checked-in [`render.yaml`](../render.yaml) describes the intended Render
topology for the Spring API, private FastAPI service, private ClamAV scanner,
Redis and a disposable PostgreSQL database. The Render application services
are image-backed and pin GHCR content digests (with `sha-<commit>` audit tags)
instead of asking Render to rebuild from source. The Next.js app belongs in a
separate Vercel project with `apps/frontend` as its root directory.

This is a deployment recipe, not proof that a hosted environment exists. No
provider credentials, domain, secret-manager access or production traffic are
present in this repository.

## Observed provider snapshot (2026-08-30)

The following is the current evidence boundary, recorded separately from this
recipe:

- Vercel has a `READY` production deployment for the static Next.js shell at
  `healthcare-two-olive.vercel.app` (deployment
  `dpl_9jbyhuR1ufDe95wWqxFGWWbjcd7S`). The deployment metadata is bound to
  source SHA `0113a87c3aeb5700a50466753f36432ae34ff0e0` with `gitDirty=false`.
  The linked project currently has only the two public indexing/site variables;
  the server-only BFF variables are intentionally absent, so
  `/api/v1/health`, catalog and triage probes return
  `503 BFF_CONFIGURATION_UNAVAILABLE`. Sixteen public route probes returned
  `200` with CSP, `X-Frame-Options: DENY`, and `nosniff` headers. This is
  static-hosting evidence only; it is not a functional chatbot or backend
  deployment.
- Render has the disposable `healthcare-beta-postgres` and
  `healthcare-beta-redis` resources, but no HealthCare application services.
  The official Blueprint validation rejected the four private/image services
  (AI, ClamAV, scanner and Spring) with `need_payment_info`; no card, paid
  upgrade or substitute public service was created. Re-run validation only
  after the workspace billing gate is deliberately resolved. See the official
  [Render Blueprint validation API](https://api-docs.render.com/reference/validate-blueprint)
  for the provider contract.
- Supabase is the confirmed Free project. The guarded reconciliation was
  applied once, then reverted as a separate recorded migration, and the DDL
  helper was hardened. The current seven-row history is baseline-shaped and
  the exact-state reapply gate passes, but no PITR/backup/branch entitlement is
  available; projection/RAG consumers remain disabled.

These observations do not authorize production traffic or override any gate
below. They must be refreshed against the exact commit being shipped.

## Immutable GHCR packages

The beta application images are published by the manually-triggered
`Publish beta application images` workflow only after a successful CI run for
the exact requested commit. It creates four canonical packages with immutable
tags:

```text
ghcr.io/jasontm17/healthcare-project-backend@sha256:<recorded-digest>
ghcr.io/jasontm17/healthcare-project-frontend@sha256:<recorded-digest>
ghcr.io/jasontm17/healthcare-project-ai-service@sha256:<recorded-digest>
ghcr.io/jasontm17/healthcare-project-attachment-scanner@sha256:<recorded-digest>
```

Each build passes the source revision as `VCS_REF` and enables BuildKit SBOM
and provenance attestations. It also publishes a signed GitHub build-provenance
attestation for the exact registry digest. A per-source concurrency lock and
preflight reject an already-existing
`sha-<commit>` tag and writes the resulting immutable digest to the run
summary. Deploy that recorded digest, not a tag or mutable `latest` reference. The
standalone seeded database remains
`healthcare-project-database:sha-<40-char-commit>` and is published by its
separate verified workflow.

Render Blueprints do not interpolate variables inside `image.url`, so refresh
the checked-in digest URLs only after the matching manual GHCR workflow has
finished and its registry digest/config label has been independently recorded.
The current application digest pins resolve the verified exact source
`f0c2363821741efe28df70d8721b6835ba86fa8f` artifacts published by workflow run
`33306135660`; each image has a SLSA provenance attestation bound to that
source. The recorded Render pins are backend
`sha256:0b0523ca2e2d9758a2a4d87dfbb826d9089b862e54cf652babf79d9c0e33bd84`, AI
`sha256:ea18c14623bfd1d65d0ffdb1d5af0631d56a6703ff0bc8e775032bb42d9f19bc`,
and attachment scanner
`sha256:052efa75e8f78147e8549f9487ec297988f0f00d61554fca77fc35a445a5235e`.
The manifest commit that records those pins can be newer than the application
image source. Do not substitute a tag or `latest` for a digest.

## Required Vercel settings

- Root directory: `apps/frontend`
- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm ci`
- Server-only `BACKEND_INTERNAL_URL`: the HTTPS Render backend URL
- Server-only `BACKEND_BFF_SERVICE_TOKEN`: a unique secret that exactly matches
  the Render backend value and contains at least 32 random bytes
- Server-only `BFF_PUBLIC_ORIGIN`: the exact HTTPS Vercel beta origin, with no
  path, query or fragment; this remains authoritative when the Route Handler
  receives an internal proxy URL
- Exact beta origin in `BFF_ALLOWED_ORIGINS` on Spring
- Empty `CORS_ALLOWED_ORIGINS`: the public Render service is not a browser API

The Node Route Handler under `/api/v1/*` is the only browser API path. It
forwards only the two HealthCare session/CSRF cookies and a closed header set;
it does not persist or log request bodies. Do not expose
`BACKEND_BFF_SERVICE_TOKEN`, `BACKEND_INTERNAL_URL`, `BFF_PUBLIC_ORIGIN`, `SUPABASE_DB_URL`,
`AI_SERVICE_TOKEN`, database credentials or a provider key as a
`NEXT_PUBLIC_*` variable. Store the BFF secret independently in the Vercel and
Render secret stores, rotate both sides together, and drain traffic during
rotation because there is no plaintext compatibility fallback. Set
`BACKEND_BFF_REQUIRED=true` on Render. Legacy bearer endpoints remain available
to non-browser API clients without an `Origin`, but the BFF rejects them and
Spring emits no CORS grant for them.

The chunked patient-chat route is opt-in and uses the persisted-answer SSE
contract. Its BFF deadline is 30 seconds and the browser deadline is 35
seconds; a timeout is surfaced as a retryable, potentially-ambiguous result so
operators must check the server history before replaying the same idempotency
key. Keep `AI_CHAT_CHUNKED_ENABLED=false` until the live canary proves this
route through the exact Vercel-to-Render path.

## Render order

1. In the already-authorized Render workspace, verify or create the disposable
   beta managed PostgreSQL/Key Value (Redis-compatible) resources. Do not reuse
   a production service or silently switch workspaces. The checked-in
   blueprint pins PostgreSQL 16 and the Singapore region so the runtime matches
   the backend/Testcontainers target. Redis is wired through Render's private
   `connectionString` as `REDIS_URL`; the Key Value public allow-list is empty.
   Set `APP_SECURITY_RATE_LIMIT_REDIS_REQUIRED=true` on the backend. The
   request limiter then uses the shared Redis counter across Render replicas
   and returns a safe 503 during a Redis outage instead of silently falling
   back to a per-process limit. On the observed Hobby workspace the two data
   resources exist, but the image-backed application services remain blocked by
   the provider payment gate described above.
   Render's
   `connectionString` is a `postgres://`/`postgresql://` URL; the Spring
   startup environment post-processor converts it to `jdbc:postgresql://` and
   keeps the username/password references separate.
2. Apply the complete Spring Flyway history (currently V1–V52, including
   V10.4/V10.5) and load only the reviewed synthetic fixture manifest. Never
   stop at V51: V52 adds the append-only clinical access-audit contract used
   by the current backend.
   V40 keeps consultation audit events after the 90-day transcript purge;
   V42 adds the opaque browser-session authority; V43 adds the server-owned
   attachment upload/scan lease lifecycle; V44 adds the encrypted email outbox;
   V45 adds notification preference categories; V46 adds the server-owned OTP
   issue timestamp; V47 adds the asynchronous attachment scan queue; V48 binds
   outbox payloads to a logical delivery id; V49 adds the terminal-row
   retention index; V50 retains the upload identity plus a leased cleanup queue
   for stale attachment workers; and V51 persists the deterministic verified
   identity before any upload can be promoted. V51 intentionally stops when
   legacy consultation attachments exist because V43–V50 cannot reconstruct
   historical upload keys; inventory or purge that synthetic data in a
   maintenance window before rerunning Flyway. These migrations are
   additive and must be applied before retention, email, attachment workers,
   or clinical access-audit reporting are enabled.
2a. Before starting any service that reads the Supabase projection, complete
   the Supabase gate in the reconciliation runbook: confirm the exact project
   ref, record a named backup/PITR restore point when the provider plan offers
   one, rehearse the guarded migration, apply only
   `20260830102500_reconcile_hosted_clinical_projection_security`, and run the
   post-apply ACL/RLS/projection contract. The selected project is Free-only,
   so scheduled backup/PITR/branch evidence is unavailable; the documented
   exception is to run `supabase/reconciliation/free-plan-preapply.sql` (or
   its exact-history reapply gate), obtain explicit manual-rollback acceptance,
   and retain `free-plan-rollback.sql` only as historical evidence for the
   already-observed five-row apply. For a new apply, freeze a new baseline and
   run the gate first; with writers still stopped, apply the migration, capture
   the provider's new audit row, then generate and verify a new compensating
   artifact bound to that baseline and row before any consumer is enabled. The
   checked-in historical rollback must fail closed after the new audit row.
   Never combine the forward SQL and rollback in one `execute_sql` call. If the
   Free-plan recovery decision or any contract check is missing, stop here; do
   not enable `RAG_STORAGE_BACKEND=supabase` and do not deploy the AI/backend
   pair against the drifted projection.
   A guarded apply was observed on the confirmed synthetic project on
   2026-08-30, then reverted by the separately recorded, watermark-guarded
   Free-plan rollback migration; a helper-hardening migration remains applied.
   The current reconciliation objects are absent and the exact seven-row
   reapply gate passes. The Free-plan no-PITR limitation remains an explicit
   manual-recovery risk, so the Supabase RAG consumer stays disabled until a
   decision owner authorizes a fresh isolated apply and the hosted service
   gates below are green.
   The read-only gate is point-in-time only: freeze projection/catalog writers
   for the maintenance window and invoke the reviewed migration immediately,
   or capture a fresh baseline and produce a new target-specific artifact.
3. Configure the private AI service with `AI_PROVIDER=local`, remote flags
   disabled, `RAG_INGEST_ENABLED=false` and
   `SUPABASE_RAG_FALLBACK_TO_MEMORY=false`. The image URL in the blueprint must
   match the GHCR digest recorded for the approved source SHA. Spring's
   separate projection worker remains closed with `AI_RAG_INGEST_ENABLED=false`
   until its token and backup/rollback drill are approved.
4. Configure Spring's CORS origin and service tokens, then wait for
   `/actuator/health` to pass. Render's private AI service uses its TCP port
   check; from a service on the same private network, run the authenticated
   `/readyz` smoke (`X-AI-Service-Token`) and record `/livez` separately. The
   Blueprint intentionally does not set `healthCheckPath` for the private
   service because Render exposes that field for web services only.
5. After the Supabase gate and service health checks pass, run admin submit →
   independent doctor approval → projection reconciliation. This operational
   reconciliation is distinct from the schema/ACL gate in step 2a.
6. Run the patient overview, consultation, patient Q&A submission/report,
   admin moderation, and three chat-mode smoke flows. A bank transfer remains
   `PENDING_VERIFICATION` until an ADMIN explicitly accepts the statement; a
   browser or webhook cannot mark it `PAID` by itself.
7. Keep consultation attachments private and quarantined as `PENDING` until a
   trusted AV/MIME worker records `CLEAN`. The browser's completion call is
   deliberately unable to assert a clean result, and attachments never enter
   DeepSeek/RAG context.
   The generic `POST /api/v1/files/upload` path first verifies that the
   filename extension, declared Content-Type and detected byte signature
   agree, then applies the same scanner gate whenever
   `STORAGE_AV_REQUIRED=true`. A MIME mismatch returns `400`; infected bytes
   return `422`; scanner outages return `503`. None of those failures writes
   object storage or metadata.
   The beta blueprint sets `STORAGE_REQUIRE_PRIVATE_ENDPOINT=true`,
   `STORAGE_UPLOAD_ENABLED=false` and `STORAGE_CONSULTATION_ENABLED=false` by
   default. Before enabling uploads, provide
   `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`,
   `STORAGE_BUCKET`, `STORAGE_REGION` and a 32-byte-plus
   `STORAGE_CONSULTATION_KEY_SIGNING_SECRET` from Render's secret store. The
   blueprint provisions `healthcare-beta-clamav` and
   `healthcare-beta-av-scanner` as private image-backed services. Spring
   receives the scanner `hostport` and exact host from Render service
   references, normalizes the internal hostport to `http://<hostport>/scan`,
   and references the scanner's `SCANNER_SERVICE_TOKEN` as
   `STORAGE_AV_SERVICE_TOKEN`; keep `STORAGE_MIME_VALIDATION_REQUIRED=true`.
   URLs with credentials,
   query/fragment data, wrong path data, or a host outside that allowlist fail
   startup/validation.
   `STORAGE_CONSULTATION_SCAN_LEASE_SECONDS` bounds
   the database-owned lease to 15 minutes. Missing credentials, localhost
   endpoints, or a missing scanner keep the backend fail-closed; no Render
   beta path falls back to `localhost:9000`. Only the trusted service can
   write scan status; a browser completion request cannot assert `CLEAN`.
   Treat `STORAGE_CONSULTATION_KEY_SIGNING_SECRET` as immutable for this beta:
   rotation would invalidate persisted upload/verified keys. A future rotation
   requires a versioned dual-key migration and a drain/reconciliation window.
8. Keep DeepSeek disabled. This build rejects either patient remote flag at
   startup and defensively disables patient-answer egress at runtime, so the
   beta must use `AI_PROVIDER=local`, both remote flags `false`, and
   `REMOTE_AI_KILL_SWITCH=true`. The provider adapters are retained only for
   isolated contract tests and do not authorize patient text. A future
   synthetic canary requires a separately reviewed implementation change plus
   evidence for retention, training, region, subprocessors, DPA and deletion.
   Private consultation messages and attachments must never enter that future
   provider path.

## Rollback

1. Keep both remote switches `false`, set clinical mode switches to `false`,
   and drain traffic.
2. Keep V36–V52 audit/schema tables; do not run an old binary that can ignore
   consent, synthetic guards, clinical approval metadata, attachment scan
   leases, object-cleanup queue, or email-outbox payload/retention contracts.
3. Reconcile the Supabase projection and verify revoked/unpublished/expired
   clinical sources and their CTAs disappear from provider context.
4. Disable consultation retention, attachment scan, object-cleanup, and
   email-outbox workers if the V40/V43/V44/V47/V50/V51/V52 audit, lease, or queue
   migrations have not been applied; never run a V39/V42-only binary against a
   V52 database.
5. Restore the disposable database only after a tested backup/restore drill.

Hosting credentials, provider/legal evidence, AV/MIME scanning, backup/restore,
live browser/Compose proof and production compliance remain explicit HOLD
gates. The local Compose verifier exercises scanner readiness, MIME mismatch
rejection and infected-upload rejection; Compose keeps the AI service on an
internal-only network while host-facing services use a separate edge bridge,
so disposable egress isolation does not hide the backend/frontend loopback
ports. Remote patient AI remains off.
This repository contains a synthetic beta implementation; it is not
authorization to accept real patient traffic.
