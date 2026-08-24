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

For a hosted project, link the project and push the migration from a trusted
operator machine. The database URL and database password are secrets and must
not be committed or exposed to the browser:

```text
supabase link --project-ref <project-ref>
supabase db push
```

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

## Security boundary

RLS is enabled on every table. Public roles can read only active catalog rows
and published AI rows. Customer and patient mirrors are inaccessible to browser
roles and can be synchronized only by a trusted server-side `service_role`.
Supabase Auth is not used as a parallel identity system.
