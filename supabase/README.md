# HealthCare Supabase data platform

This directory is an additive Supabase/Postgres persistence slice. It keeps
the existing Spring/Flyway `public` schema intact and adds a `healthcare`
schema for the public catalog, a server-managed synthetic customer mirror, and the AI
retrieval store.

## Apply locally or remotely

The local path is isolated from the project's existing Docker Postgres:

```text
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/healthcare_data_platform.sql
```

For a new empty hosted project, link the project and push migrations from a
trusted operator machine. The database URL and database password are secrets
and must not be committed or exposed to the browser:

```text
supabase link --project-ref <project-ref>
supabase db push
```

### Hosted migration gate (mandatory)

Never run `supabase db push`, `db reset`, or the seed against an unverified
project. First capture a backup/PITR point when the plan provides one, confirm
the exact project reference, inspect `supabase migration list`, inspect the
current tables/RLS/policies and run the local SQL contracts. The local tree has
seven additive migrations while the confirmed hosted target has eight audited
provider rows; those histories are intentionally not interchangeable. The
first local migration contains non-idempotent `CREATE TABLE` statements, so
pushing it directly to the hosted target can collide with existing objects and
remains blocked. The target was reconciled through one explicitly reviewed,
writer-locked migration instead of a wholesale history push.

For the reviewed existing target, the only structural candidate is
`20260830102500_reconcile_hosted_clinical_projection_security.sql`. Apply that
single migration only after the gate in
`supabase/reconciliation/README.md` is satisfied; do not substitute a
wholesale `supabase db push`. Then run the read-only
`supabase/tests/hosted_reconciliation_contract.sql` against the same confirmed
ref.

For the currently confirmed project `awaknzhadjglbfkhigck`, the writer-locked
reconciliation was applied once on 2026-08-30 and the hosted contract passed.
The remote audit history is the exact eight-row set ending in
`20260830143140`; all reconciliation columns, constraints, indexes, routines
and the tombstone trigger are present, while the original counts and
watermarks remain unchanged. The exact compensating artifact is
[`reconciliation/free-plan-rollback-writer-lock-20260830.sql`](reconciliation/free-plan-rollback-writer-lock-20260830.sql);
it has not been executed. The project remains on Free with no PITR/restore
point, so this is manual recovery evidence rather than a provider backup or
production-cutover signal. The Render Free AI beta may ingest Spring's public
operational catalog into its own ephemeral memory index; it does not use the
Supabase patient-chat projection or a Supabase database DSN. Those durable
RAG/patient-chat consumers remain disabled until a separately reviewed hosted
release supplies a server-only connection contract.

The read-only reapply gate is a point-in-time check, not a database lock. Any
future change must run in a writer-quiesced maintenance window and immediately
follow a fresh gate; otherwise capture a new snapshot and review a new
target-specific migration. Never reuse either historical rollback migration
against a drifted target or present a compensating capsule as PITR.

### Current read-only verification (2026-09-02)

The linked project `awaknzhadjglbfkhigck` responded `ACTIVE_HEALTHY` on Postgres
17 and exposed the expected eight migration rows ending at `20260830143140`.
All 15 healthcare tables have RLS enabled. Aggregate counts are 100,000
synthetic customers, 75,000 synthetic profiles, 10,000 public RAG documents,
830 de-identified chat-projection documents, 37 seed chunks, and the expected
catalog/link counts recorded in the deployment release note. The read-only
contract also confirmed the chat tombstone column, constraint, trigger and
cursor index; pagination and match functions are invoker-mode and executable
only by `service_role`, while browser roles cannot read server-only projection
tables. No DDL, migration, reset or seed command was issued during this check.
The security advisor returned INFO-only deny-by-default notices for the
server-only tables with no policies; the performance advisor returned INFO-only
unused-index notices. These were not auto-remediated because removing or adding
policies/indexes would be a separate reviewed schema change.

The reconciliation preserves Spring PostgreSQL as the transactional identity
and clinical authority. Supabase is the `healthcare`-schema catalog and
de-identified chatbot projection; it is not a drop-in replacement for the
Spring `public` Flyway database. The hosted ACL/RLS/count/canary evidence is
recorded in `reconciliation/README.md`; do not use a destructive reset to make
histories look equal.

`supabase/seed.sql` is deterministic and non-destructive. It is loaded by a
local `db reset`; for a remote environment, run it only after reviewing the
target and the expected synthetic-data volume.

## AI-service connection contract

The durable adapter is opt-in. Local and test runtimes retain the current
in-memory service unless a database is explicitly configured.

```text
RAG_STORAGE_BACKEND=memory|supabase
SUPABASE_DB_URL=postgresql://<role>:<password>@<host>:<port>/<database>
SUPABASE_DB_SCHEMA=healthcare
# Patient-chat projection; keep the legacy catalog index separate.
SUPABASE_RAG_TABLE=ai_chat_documents
SUPABASE_RAG_RPC=match_chat_documents
SUPABASE_DB_CONNECT_TIMEOUT_SECONDS=5
SUPABASE_RAG_FALLBACK_TO_MEMORY=true|false
RAG_EMBEDDING_DIMENSION=384
```

`SUPABASE_DB_URL` is a PostgreSQL or Supavisor URI, not the Spring JDBC
`DATABASE_URL`. In production, use a server-side secret and set
`SUPABASE_RAG_FALLBACK_TO_MEMORY=false` so a database outage is visible rather
than silently losing durability. In local/test/demo, fallback remains enabled
by default.

The adapter factory is `app.supabase_rag.build_rag_service(settings)`. The
AI service bootstrap uses that factory so local/test runtimes keep the current
in-memory service by default while explicit Supabase configuration can switch
to the durable store.

## Data model and seed mapping

### Dashboard schema note

The HealthCare tables intentionally live in the `healthcare` schema, not
`public`. In Supabase Table Editor open the schema selector currently showing
`public` and choose `healthcare`; an empty `public` table list is expected. The
customer/profile/checkpoint/chat-projection tables remain server-only even
though they are visible to an authenticated dashboard administrator.

- Catalog tables: `specialties`, `branches`, `doctors`, `services`, `packages`,
  `articles`, `faqs`, and the two doctor join tables.
- Synthetic mirror: `customers` and one-to-one `patient_profiles`. The first
  1,000 synthetic `legacy_user_id` values match the existing backend
  `md5('large-user:' || i)::uuid` family. `auth_user_id` is correlation-only;
  Spring Boot/PostgreSQL remains the account and authorization authority.
- Legacy catalog vector store: one `ai_documents` row per `(source_type,
  source_id)`. It remains the public catalog/old-index contract and is not the
  patient-chat projection.
- Patient chatbot projection: `ai_chat_documents` is a separate service-only
  table keyed by `(projection_kind, source_type, source_id)`. It stores only
  de-identified operational or approved clinical source content, a
  384-dimensional `extensions.vector`, canonical content/eligibility
  revisions, approval expiry metadata, provenance, and monotonic tombstones.
- Patient retrieval: `healthcare.match_chat_documents` is `SECURITY INVOKER`,
  accepts only the protected 384-dim vector contract, filters inactive,
  unpublished, deleted, and expired clinical rows, and is executable only by
  `service_role`. Spring still performs the authoritative SQL checks before
  provider context and again before display/persistence.

The seed creates 30 specialties, 20 branches, 500 doctors, 200 services, 100
packages, 500 articles, 150 FAQs, 10,000 customers, 7,500 patient profiles,
and 1,480 catalog RAG documents. Every value is fictional. Seed vectors are
deterministic hash fixtures (`seed-hash-384`), useful for reset and SQL smoke
tests but not a claim of clinical semantic quality; a trusted embedding sync
must replace them before ranking quality is evaluated.

## Scalable synthetic import

The optional generator keeps the reset seed unchanged and writes set-based,
idempotent SQL chunks plus a resumable manifest. It starts with the existing
1,480 catalog documents and generates the remaining rows needed to reach the
10,000 public-document target:

```powershell
python supabase/tools/generate_synthetic_data.py generate `
  --output-dir supabase/.synthetic-output/v2
```

The default contract is 100,000 customers, 75,000 patient profiles, 10,000
public RAG documents, 384 dimensions and 5,000 rows per chunk. Customer chunks
run before profile chunks, and RAG chunks verify the 1,480-row catalog baseline
before upserting synthetic public articles. Re-running `generate` verifies the
manifest and recreates only missing files; it never deletes existing output.

After reviewing the target and setting a server-side `SUPABASE_DB_URL`, pending
chunks can be applied through `psql`:

```powershell
python supabase/tools/generate_synthetic_data.py apply `
  --manifest supabase/.synthetic-output/v2/manifest.json
```

The tool does not accept source files, does not load real patients, and never
prints the database URL. The `synthetic_seed_runs` and
`synthetic_seed_chunks` tables are service-role-only checkpoints; they are not
browser APIs. Apply the structural gate with:

```text
psql <database-url> -f supabase/tests/big_data_vector_contract.sql
```

The reviewed remote expansion currently uses the default `v2-100k-75k-10k`
contract: 100,000 synthetic customers, 75,000 synthetic profiles and 10,000
384-dimensional public RAG documents. It is separate from the protected
patient-chat projection (`ai_chat_documents`), which only receives operational
or independently approved clinical projections.

## Supabase Free deployment boundary

This project is configured for the Supabase **Free** plan only. Do not upgrade
the project, create a paid development branch, or claim scheduled backup/PITR
coverage. The confirmed target has eight provider migration rows and the
writer-locked reconciliation/canaries have passed once; the exact state and
provider hashes are recorded in
[`reconciliation/README.md`](reconciliation/README.md). The checked-in
`free-plan-rollback-writer-lock-20260830.sql` is a guarded, target-specific
compensating capsule. It is manual recovery evidence, has not been executed,
and is not a provider backup. Any future apply needs a new point-in-time gate,
writer quiescence, and a newly bound capsule. Enabling the separate in-memory
Render catalog ingest does not authorize a Supabase database consumer. Keep
Supabase durable-RAG and patient-chat consumers off until a coordinated release
owner enables them after a fresh hosted contract.

## Security boundary

RLS is enabled on every table. Public roles can read only active catalog rows
and published AI rows. Customer and patient mirrors are inaccessible to browser
roles and can be synchronized only by a trusted server-side `service_role`.
Supabase Auth is not used as a parallel identity system.
