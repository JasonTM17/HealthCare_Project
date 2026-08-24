-- Protected projection for the patient chatbot.
--
-- Patient conversations/messages remain in Spring PostgreSQL.  This table is
-- only a server-managed, de-identified projection of operational or approved
-- clinical source content; browser roles must never read or write it.

begin;

create table healthcare.ai_chat_documents (
    id uuid primary key default extensions.gen_random_uuid(),
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
    embedding_model text not null default 'local-hash',
    embedding_provenance text not null default 'local_provider',
    active boolean not null default true,
    published boolean not null default true,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    search_vector tsvector generated always as (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) stored,

    constraint ai_chat_documents_projection_kind check (
        projection_kind in ('OPERATIONAL', 'CLINICAL')
    ),
    constraint ai_chat_documents_source_type check (
        source_type in ('specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq')
    ),
    constraint ai_chat_documents_source_id check (
        source_id ~ '^[A-Za-z0-9._:-]+$' and length(source_id) between 1 and 200
    ),
    constraint ai_chat_documents_revision check (
        content_revision > 0 and eligibility_revision > 0
    ),
    constraint ai_chat_documents_hash check (content_hash ~ '^[0-9a-f]{64}$'),
    constraint ai_chat_documents_approval_metadata check (
        projection_kind = 'OPERATIONAL'
        or deleted_at is not null
        or (approval_round is not null and approval_round > 0 and approval_expires_at is not null)
    ),
    constraint ai_chat_documents_title_size check (length(title) between 1 and 500),
    constraint ai_chat_documents_content_size check (length(content) between 1 and 20000),
    constraint ai_chat_documents_metadata_object check (jsonb_typeof(metadata) = 'object'),
    constraint ai_chat_documents_embedding_shape check (
        embedding is null or extensions.vector_dims(embedding) = 384
    ),
    constraint ai_chat_documents_provenance check (
        embedding_provenance in ('local_provider', 'remote_provider', 'local_fallback')
    ),
    constraint ai_chat_documents_embedding_model check (
        length(btrim(embedding_model)) between 1 and 200
    ),
    constraint ai_chat_documents_unique_source unique (projection_kind, source_type, source_id)
);

create index ai_chat_documents_eligible_source_idx
    on healthcare.ai_chat_documents(projection_kind, source_type, source_id, eligibility_revision desc)
    where active and published and deleted_at is null;

create index ai_chat_documents_content_hash_idx
    on healthcare.ai_chat_documents(content_hash);

create index ai_chat_documents_search_vector_idx
    on healthcare.ai_chat_documents using gin(search_vector);

create index ai_chat_documents_embedding_hnsw_idx
    on healthcare.ai_chat_documents
    using hnsw (embedding extensions.vector_cosine_ops)
    where embedding is not null and active and published and deleted_at is null;

alter table healthcare.ai_chat_documents enable row level security;
revoke all privileges on table healthcare.ai_chat_documents from anon, authenticated;
grant all privileges on table healthcare.ai_chat_documents to service_role;

create trigger ai_chat_documents_touch_updated_at
before update on healthcare.ai_chat_documents
for each row execute function healthcare.touch_updated_at();

comment on table healthcare.ai_chat_documents is
    'Server-only de-identified patient-chat projection; Spring PostgreSQL owns identity, approval and history';
comment on column healthcare.ai_chat_documents.eligibility_revision is
    'Spring-owned monotonic approval/visibility revision; stale events must not resurrect a row';
comment on column healthcare.ai_chat_documents.approval_expires_at is
    'Copied from the independent doctor approval round; retrieval must also compare it with database time';

-- The AI service calls this SECURITY INVOKER function over a service-only
-- database connection.  It deliberately returns the full projection
-- authority fields so hydration cannot silently downgrade a clinical row to
-- an operational citation.  Spring performs the final SQL authorization
-- check before a provider call and again before persistence/display.
create or replace function healthcare.match_chat_documents(
    query_embedding extensions.vector(384),
    match_threshold real default 0.35,
    match_count integer default 5,
    source_types_filter text[] default null,
    projection_filter text default null
)
returns table (
    id uuid,
    source_type text,
    source_id text,
    title text,
    content text,
    metadata jsonb,
    projection_kind text,
    content_revision bigint,
    eligibility_revision bigint,
    content_hash text,
    approval_round bigint,
    approval_expires_at timestamptz,
    embedding text,
    embedding_model text,
    embedding_provenance text,
    active boolean,
    published boolean,
    score real
)
language sql
stable
set search_path = healthcare, extensions, pg_catalog
as $$
    select d.id,
           d.source_type,
           d.source_id,
           d.title,
           d.content,
           d.metadata,
           d.projection_kind,
           d.content_revision,
           d.eligibility_revision,
           d.content_hash,
           d.approval_round,
           d.approval_expires_at,
           null::text as embedding,
           d.embedding_model,
           d.embedding_provenance,
           d.active,
           d.published,
           (1 - (d.embedding <=> query_embedding))::real as score
      from healthcare.ai_chat_documents d
     where d.embedding is not null
       and d.active
       and d.published
       and d.deleted_at is null
       and (source_types_filter is null or d.source_type = any(source_types_filter))
       and (projection_filter is null or d.projection_kind = upper(projection_filter))
       and (
            d.projection_kind = 'OPERATIONAL'
            or (d.approval_round is not null and d.approval_expires_at > current_timestamp)
       )
       and (1 - (d.embedding <=> query_embedding)) >= match_threshold
     order by score desc, d.id
     limit least(greatest(match_count, 1), 20);
$$;

revoke all on function healthcare.match_chat_documents(
    extensions.vector(384), real, integer, text[], text
) from public, anon, authenticated;
grant execute on function healthcare.match_chat_documents(
    extensions.vector(384), real, integer, text[], text
) to service_role;

commit;
