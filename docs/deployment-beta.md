# Synthetic beta deployment runbook

The checked-in [`render.yaml`](../render.yaml) describes the intended Render
topology for the Spring API, private FastAPI service, Redis and a disposable
PostgreSQL database. The Next.js app belongs in a separate Vercel project with
`apps/frontend` as its root directory.

This is a deployment recipe, not proof that a hosted environment exists. No
provider credentials, domain, secret-manager access or production traffic are
present in this repository.

## Required Vercel settings

- Root directory: `apps/frontend`
- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm ci`
- Server-only `BACKEND_INTERNAL_URL`: the HTTPS Render backend URL
- Explicit beta origin in `CORS_ALLOWED_ORIGINS` on Spring

Next's same-origin `/api/v1/*` rewrite remains the only browser API path. Do
not expose `SUPABASE_DB_URL`, `AI_SERVICE_TOKEN`, database credentials or a
provider key as a `NEXT_PUBLIC_*` variable.

## Render order

1. Create a separate beta workspace and disposable managed PostgreSQL/Redis.
2. Apply Flyway V36–V40 and load only the reviewed synthetic fixture manifest.
   V40 keeps consultation audit events after the 90-day transcript purge; it
   is additive and must be applied before any retention worker is enabled.
3. Configure the private AI service with `AI_PROVIDER=local`, remote flags
   disabled and `SUPABASE_RAG_FALLBACK_TO_MEMORY=false`.
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
8. Keep DeepSeek disabled until provider retention/training/region/subprocessor
   and deletion evidence is recorded. A synthetic canary, if later authorized,
   requires all of the following at once:

   ```text
   AI_SERVICE_RUNTIME=synthetic-beta
   AI_PROVIDER=deepseek
   AI_PATIENT_CHAT_REMOTE_ENABLED=true
   AI_CHAT_REMOTE_PROVIDER_ENABLED=true
   REMOTE_AI_SYNTHETIC_ONLY=true
   REMOTE_AI_KILL_SWITCH=false
   RAG_STORAGE_BACKEND=supabase
   SUPABASE_RAG_FALLBACK_TO_MEMORY=false
   RAG_EMBEDDING_DIMENSION=384
   ```

   The Spring request path must additionally assert `synthetic_beta=true` only
   after it has verified synthetic user/profile/appointment markers. Private
   consultation messages and attachments never enter this provider path.

## Rollback

1. Set both remote switches to `false`, set clinical mode switches to `false`,
   and drain traffic.
2. Keep V36–V40 audit/schema tables; do not run an old binary that can ignore
   consent, synthetic guards or clinical approval metadata.
3. Reconcile the Supabase projection and verify revoked/unpublished/expired
   clinical sources and their CTAs disappear from provider context.
4. Disable the consultation retention scheduler if the V40 audit trigger has
   not been applied; never run a V39-only binary against a V40 database.
5. Restore the disposable database only after a tested backup/restore drill.

Hosting credentials, provider/legal evidence, AV/MIME scanning, backup/restore,
live browser/Compose proof and production compliance remain explicit HOLD
gates. This repository contains a synthetic beta implementation; it is not
authorization to accept real patient traffic.
