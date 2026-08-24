-- Controlled, idempotent projection reconciliation template.
--
-- Run only through a trusted service-role/database connection.  Spring is the
-- source of truth: load a complete, de-identified batch into the temporary
-- table below (for example with psql `\copy ... FROM 'reviewed-batch.csv'`)
-- before the upsert section.  This script never reads patient/chat tables and
-- never invents clinical approval metadata.
--
-- The batch must contain full projection rows.  Use operation TOMBSTONE for a
-- source that Spring has made ineligible; do not infer deletions from a partial
-- page.  Re-running the exact batch is a no-op and is safe after a worker
-- restart.  A changed hash at an equal eligibility revision fails closed.

\set ON_ERROR_STOP on
begin;
set local search_path = healthcare, extensions, public;
set local statement_timeout = '2min';

create temporary table chat_projection_reconciliation_batch (
    operation text not null check (operation in ('UPSERT', 'TOMBSTONE')),
    projection_kind text not null,
    source_type text not null,
    source_id text not null,
    content_revision bigint not null,
    eligibility_revision bigint not null,
    content_hash text not null,
    approval_round bigint,
    approval_expires_at timestamptz,
    title text not null,
    content text not null,
    metadata jsonb not null default '{}'::jsonb,
    embedding extensions.vector(384),
    embedding_model text not null,
    embedding_provenance text not null,
    active boolean not null,
    published boolean not null,
    deleted_at timestamptz,
    updated_at timestamptz not null,
    primary key (projection_kind, source_type, source_id),
    check (content_revision > 0 and eligibility_revision > 0),
    check (content_hash ~ '^[0-9a-f]{64}$'),
    check (projection_kind in ('OPERATIONAL', 'CLINICAL')),
    check (source_type in ('specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq')),
    check (source_id ~ '^[A-Za-z0-9._:-]+$' and length(source_id) between 1 and 200),
    check (jsonb_typeof(metadata) = 'object'),
    check (embedding is null or extensions.vector_dims(embedding) = 384),
    check (projection_kind = 'OPERATIONAL' or deleted_at is not null
           or (approval_round is not null and approval_expires_at is not null)),
    check ((operation = 'TOMBSTONE' and deleted_at is not null and not active and not published)
           or operation = 'UPSERT')
) on commit drop;

-- Load reviewed rows here before executing the remainder, e.g.:
-- \copy chat_projection_reconciliation_batch FROM 'reviewed-batch.csv' WITH (FORMAT csv, HEADER true)

do $$
begin
    if exists (
        select 1
          from chat_projection_reconciliation_batch
         where projection_kind = 'CLINICAL'
           and (approval_round is null or approval_expires_at <= current_timestamp)
           and operation <> 'TOMBSTONE'
    ) then
        raise exception 'clinical batch contains a missing or expired approval';
    end if;
end;
$$;

insert into healthcare.ai_chat_documents (
    projection_kind, source_type, source_id, content_revision,
    eligibility_revision, content_hash, approval_round, approval_expires_at,
    title, content, metadata, embedding, embedding_model, embedding_provenance,
    active, published, deleted_at, updated_at
)
select projection_kind, source_type, source_id, content_revision,
       eligibility_revision, content_hash, approval_round, approval_expires_at,
       title, content, metadata, embedding, embedding_model, embedding_provenance,
       active, published, deleted_at, updated_at
  from chat_projection_reconciliation_batch
on conflict (projection_kind, source_type, source_id) do update
set content_revision = excluded.content_revision,
    eligibility_revision = excluded.eligibility_revision,
    content_hash = excluded.content_hash,
    approval_round = excluded.approval_round,
    approval_expires_at = excluded.approval_expires_at,
    title = excluded.title,
    content = excluded.content,
    metadata = excluded.metadata,
    embedding = excluded.embedding,
    embedding_model = excluded.embedding_model,
    embedding_provenance = excluded.embedding_provenance,
    active = excluded.active,
    published = excluded.published,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at
where healthcare.ai_chat_documents.eligibility_revision < excluded.eligibility_revision
   or (
       healthcare.ai_chat_documents.eligibility_revision = excluded.eligibility_revision
       and healthcare.ai_chat_documents.content_hash = excluded.content_hash
   );

-- A skipped stale row is an error, not a silent acknowledgement.  The worker
-- must fetch the current projection and return its stored revision/hash/state.
do $$
begin
    if exists (
        select 1
          from chat_projection_reconciliation_batch b
          left join healthcare.ai_chat_documents d
            on d.projection_kind = b.projection_kind
           and d.source_type = b.source_type
           and d.source_id = b.source_id
         where d.id is null
            or d.eligibility_revision <> b.eligibility_revision
            or d.content_hash <> b.content_hash
            or (b.operation = 'TOMBSTONE' and d.deleted_at is null)
    ) then
        raise exception 'projection acknowledgement mismatch; reconcile against current authority';
    end if;
end;
$$;

commit;
