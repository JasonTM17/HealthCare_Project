-- Additive contract for the scalable synthetic-data and vector wave.
--
-- Spring/PostgreSQL remains the identity and clinical authority. These
-- bookkeeping tables are server-only; they make generated chunks resumable
-- without exposing a client-side import API or patient data.

begin;

alter table healthcare.ai_documents
    add column if not exists embedding_dimension smallint not null default 384,
    add column if not exists published_at timestamptz;

-- Existing catalog rows predate published_at. Backfill from their own row
-- timestamps before enforcing the public-document publication contract.
update healthcare.ai_documents
set published_at = coalesce(updated_at, created_at)
where published
  and published_at is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_embedding_dimension_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_embedding_dimension_check
            check (embedding_dimension = 384);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_embedding_shape_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_embedding_shape_check
            check (
                embedding is null
                or extensions.vector_dims(embedding) = embedding_dimension
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_content_hash_format_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_content_hash_format_check
            check (content_hash ~ '^[0-9a-f]{64}$');
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_sync_revision_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_sync_revision_check
            check (sync_revision >= 0);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_embedding_model_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_embedding_model_check
            check (length(btrim(embedding_model)) between 1 and 200);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.ai_documents'::regclass
          and conname = 'ai_documents_published_at_check'
    ) then
        alter table healthcare.ai_documents
            add constraint ai_documents_published_at_check
            check (not published or published_at is not null);
    end if;
end;
$$;

create index if not exists ai_documents_embedding_profile_idx
    on healthcare.ai_documents (
        embedding_model,
        embedding_dimension,
        embedding_provenance,
        sync_revision
    )
    where embedding is not null
      and active
      and published
      and deleted_at is null;

create index if not exists ai_documents_content_hash_idx
    on healthcare.ai_documents (content_hash);

create index if not exists ai_documents_published_at_idx
    on healthcare.ai_documents (published_at desc)
    where active and published and deleted_at is null;

create table if not exists healthcare.synthetic_seed_runs (
    id uuid primary key default extensions.gen_random_uuid(),
    dataset_key text not null,
    dataset_version text not null,
    seed bigint not null,
    target_customers integer not null check (target_customers >= 0),
    target_patient_profiles integer not null check (target_patient_profiles >= 0),
    target_public_rag_documents integer not null check (target_public_rag_documents >= 0),
    chunk_size integer not null check (chunk_size > 0),
    manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
    status text not null default 'PENDING'
        check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (dataset_key, dataset_version, seed)
);

create table if not exists healthcare.synthetic_seed_chunks (
    id uuid primary key default extensions.gen_random_uuid(),
    run_id uuid not null references healthcare.synthetic_seed_runs(id) on delete cascade,
    entity_type text not null
        check (entity_type in ('CUSTOMER', 'PATIENT_PROFILE', 'PUBLIC_RAG_DOCUMENT')),
    chunk_no integer not null check (chunk_no >= 1),
    range_start bigint not null check (range_start >= 1),
    range_end bigint not null check (range_end >= range_start),
    expected_rows bigint not null check (expected_rows >= 0),
    processed_rows bigint not null default 0
        check (processed_rows >= 0 and processed_rows <= expected_rows),
    status text not null default 'PENDING'
        check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    checksum text check (checksum is null or checksum ~ '^[0-9a-f]{64}$'),
    error_message text check (error_message is null or length(error_message) <= 1000),
    started_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (run_id, entity_type, chunk_no),
    unique (run_id, entity_type, range_start, range_end)
);

create index if not exists synthetic_seed_runs_status_idx
    on healthcare.synthetic_seed_runs (status, updated_at);
create index if not exists synthetic_seed_chunks_pending_idx
    on healthcare.synthetic_seed_chunks (run_id, entity_type, status, chunk_no);

alter table healthcare.synthetic_seed_runs enable row level security;
alter table healthcare.synthetic_seed_chunks enable row level security;
revoke all privileges on table
    healthcare.synthetic_seed_runs,
    healthcare.synthetic_seed_chunks
from anon, authenticated;
grant all privileges on table
    healthcare.synthetic_seed_runs,
    healthcare.synthetic_seed_chunks
to service_role;

create trigger synthetic_seed_runs_touch_updated_at
before update on healthcare.synthetic_seed_runs
for each row execute function healthcare.touch_updated_at();

create trigger synthetic_seed_chunks_touch_updated_at
before update on healthcare.synthetic_seed_chunks
for each row execute function healthcare.touch_updated_at();

comment on column healthcare.ai_documents.embedding_dimension is
    'Required vector dimension for this retrieval profile; current contract is 384';
comment on column healthcare.ai_documents.published_at is
    'Deterministic/publication timestamp used by catalog and RAG visibility checks';
comment on table healthcare.synthetic_seed_runs is
    'Server-only manifest registry for deterministic, resumable synthetic imports';
comment on table healthcare.synthetic_seed_chunks is
    'Server-only chunk checkpoints; contains no patient payload or raw clinical data';

commit;
