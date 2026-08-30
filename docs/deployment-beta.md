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
`f1667e18481fd9c6e79d1661e77541b18194a6fd` artifacts published by the
post-merge workflow. The manifest commit that records those pins can be newer
than the application image source. Do not substitute a tag or `latest` for a
digest.

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

1. In the already-authorized Render workspace, create the disposable beta
   managed PostgreSQL/Key Value (Redis-compatible) resources. Do not reuse a
   production service or silently switch workspaces. The checked-in blueprint
   pins PostgreSQL 16 and the Singapore region so the runtime matches the
   backend/Testcontainers target. Redis is wired through Render's private
   `connectionString` as `REDIS_URL`; the Key Value public allow-list is empty.
   Set `APP_SECURITY_RATE_LIMIT_REDIS_REQUIRED=true` on the backend. The
   request limiter then uses the shared Redis counter across Render replicas
   and returns a safe 503 during a Redis outage instead of silently falling
   back to a per-process limit.
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
5. Run admin submit → independent doctor approval → projection reconciliation.
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
