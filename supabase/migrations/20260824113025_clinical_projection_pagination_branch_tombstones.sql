-- Additive clinical catalog fields and protected projection pagination.
--
-- Spring PostgreSQL remains the authority for clinical approval/revision and
-- patient identity.  This migration only extends the de-identified Supabase
-- catalog/projection and adds service-role reconciliation RPCs.  It is safe to
-- apply before any branch/clinical projection rows are present.

begin;

alter table healthcare.articles
    add column if not exists content_language text not null default 'vi',
    add column if not exists audience text not null default 'GENERAL',
    add column if not exists topic_tags jsonb not null default '[]'::jsonb,
    add column if not exists key_takeaways jsonb not null default '[]'::jsonb,
    add column if not exists warning_signs jsonb not null default '[]'::jsonb,
    add column if not exists prevention_tips jsonb not null default '[]'::jsonb,
    add column if not exists when_to_seek_care text,
    add column if not exists source_references jsonb not null default '[]'::jsonb,
    add column if not exists clinical_metadata jsonb not null default '{}'::jsonb,
    add column if not exists clinical_disclaimer text,
    add column if not exists last_reviewed_at timestamptz,
    add column if not exists last_reviewed_by text,
    add column if not exists featured boolean not null default false;

alter table healthcare.specialties
    add column if not exists clinical_overview text,
    add column if not exists common_conditions jsonb not null default '[]'::jsonb,
    add column if not exists red_flags jsonb not null default '[]'::jsonb,
    add column if not exists preventive_care jsonb not null default '[]'::jsonb,
    add column if not exists when_to_seek_care text,
    add column if not exists source_references jsonb not null default '[]'::jsonb,
    add column if not exists clinical_metadata jsonb not null default '{}'::jsonb,
    add column if not exists last_reviewed_at timestamptz,
    add column if not exists last_reviewed_by text;

alter table healthcare.faqs
    add column if not exists category text,
    add column if not exists audience text not null default 'GENERAL',
    add column if not exists topic_tags jsonb not null default '[]'::jsonb,
    add column if not exists related_specialty_slug text,
    add column if not exists source_references jsonb not null default '[]'::jsonb,
    add column if not exists clinical_metadata jsonb not null default '{}'::jsonb,
    add column if not exists clinical_disclaimer text,
    add column if not exists sort_order integer not null default 0,
    add column if not exists last_reviewed_at timestamptz,
    add column if not exists last_reviewed_by text;

alter table healthcare.ai_documents
    drop constraint if exists ai_documents_source_type;
alter table healthcare.ai_documents
    add constraint ai_documents_source_type check (
        source_type in ('specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq')
    );

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'articles_rich_content_shape') then
        alter table healthcare.articles add constraint articles_rich_content_shape check (
            content_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
            and audience in ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL')
            and jsonb_typeof(topic_tags) = 'array'
            and jsonb_typeof(key_takeaways) = 'array'
            and jsonb_typeof(warning_signs) = 'array'
            and jsonb_typeof(prevention_tips) = 'array'
            and jsonb_typeof(source_references) = 'array'
            and jsonb_typeof(clinical_metadata) = 'object'
            and pg_column_size(clinical_metadata) <= 65536
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'specialties_rich_content_shape') then
        alter table healthcare.specialties add constraint specialties_rich_content_shape check (
            jsonb_typeof(common_conditions) = 'array'
            and jsonb_typeof(red_flags) = 'array'
            and jsonb_typeof(preventive_care) = 'array'
            and jsonb_typeof(source_references) = 'array'
            and jsonb_typeof(clinical_metadata) = 'object'
            and pg_column_size(clinical_metadata) <= 65536
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'faqs_rich_content_shape') then
        alter table healthcare.faqs add constraint faqs_rich_content_shape check (
            audience in ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL')
            and jsonb_typeof(topic_tags) = 'array'
            and jsonb_typeof(source_references) = 'array'
            and jsonb_typeof(clinical_metadata) = 'object'
            and pg_column_size(clinical_metadata) <= 65536
            and sort_order >= 0
        );
    end if;
end $$;

create index if not exists healthcare_articles_rich_topic_tags_idx
    on healthcare.articles using gin(topic_tags);
create index if not exists healthcare_specialties_rich_conditions_idx
    on healthcare.specialties using gin(common_conditions);
create index if not exists healthcare_faqs_rich_topic_tags_idx
    on healthcare.faqs using gin(topic_tags);
create index if not exists healthcare_faqs_rich_related_specialty_idx
    on healthcare.faqs(related_specialty_slug)
    where active;
create index if not exists healthcare_ai_documents_branch_idx
    on healthcare.ai_documents(source_type, source_id)
    where source_type = 'branch' and active and published and deleted_at is null;

-- Tombstones carry the exact eligibility revision that made a projection
-- ineligible.  A newer revision may revive a row; an equal/older revision may
-- never resurrect it, even if a delayed worker retries an old upsert.
alter table healthcare.ai_chat_documents
    add column if not exists tombstone_revision bigint;

update healthcare.ai_chat_documents
   set tombstone_revision = eligibility_revision
 where deleted_at is not null
   and tombstone_revision is null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conrelid = 'healthcare.ai_chat_documents'::regclass
           and conname = 'ai_chat_documents_tombstone_shape'
    ) then
        alter table healthcare.ai_chat_documents add constraint ai_chat_documents_tombstone_shape check (
            (deleted_at is null and tombstone_revision is null)
            or (deleted_at is not null and tombstone_revision is not null and tombstone_revision > 0)
        );
    end if;
end $$;

create or replace function healthcare.ai_chat_documents_tombstone_guard()
returns trigger
language plpgsql
set search_path = healthcare, pg_catalog
as $$
begin
    if tg_op = 'UPDATE' then
        if new.eligibility_revision < old.eligibility_revision then
            raise exception 'projection eligibility revision cannot move backwards'
                using errcode = '40001';
        end if;

        if new.eligibility_revision = old.eligibility_revision
           and new.content_hash <> old.content_hash then
            raise exception 'equal-revision projection update must be idempotent'
                using errcode = '40001';
        end if;

        if old.deleted_at is not null and new.deleted_at is null
           and new.eligibility_revision <= old.tombstone_revision then
            raise exception 'stale projection cannot resurrect a tombstone'
                using errcode = '40001';
        end if;

        if old.deleted_at is not null and new.deleted_at is not null
           and new.eligibility_revision < old.tombstone_revision then
            raise exception 'tombstone revision cannot move backwards'
                using errcode = '40001';
        end if;
    end if;

    if new.deleted_at is not null then
        new.tombstone_revision := coalesce(new.tombstone_revision, new.eligibility_revision);
    else
        new.tombstone_revision := null;
    end if;
    return new;
end;
$$;

drop trigger if exists ai_chat_documents_tombstone_guard
    on healthcare.ai_chat_documents;
create trigger ai_chat_documents_tombstone_guard
before insert or update on healthcare.ai_chat_documents
for each row execute function healthcare.ai_chat_documents_tombstone_guard();
revoke execute on function healthcare.ai_chat_documents_tombstone_guard() from public, anon, authenticated;

create index if not exists ai_chat_documents_projection_cursor_idx
    on healthcare.ai_chat_documents(projection_kind, updated_at desc, id desc);
create index if not exists ai_chat_documents_branch_cursor_idx
    on healthcare.ai_chat_documents(updated_at desc, id desc)
    where projection_kind = 'OPERATIONAL' and source_type = 'branch';

-- Service-only keyset listing for reconciliation.  The `(updated_at, id)`
-- pair is the cursor; callers pass both values from the final returned row.
-- Deleted rows are included by default so a worker can acknowledge tombstones.
create or replace function healthcare.list_chat_documents_page(
    projection_filter text default null,
    source_types_filter text[] default null,
    cursor_updated_at timestamptz default null,
    cursor_id uuid default null,
    page_size integer default 500,
    include_deleted boolean default true
)
returns table (
    id uuid,
    projection_kind text,
    source_type text,
    source_id text,
    content_revision bigint,
    eligibility_revision bigint,
    content_hash text,
    approval_round bigint,
    approval_expires_at timestamptz,
    title text,
    content text,
    metadata jsonb,
    embedding_model text,
    embedding_provenance text,
    active boolean,
    published boolean,
    deleted_at timestamptz,
    tombstone_revision bigint,
    updated_at timestamptz
)
language sql
stable
security invoker
set search_path = healthcare, pg_catalog
as $$
    select d.id, d.projection_kind, d.source_type, d.source_id,
           d.content_revision, d.eligibility_revision, d.content_hash,
           d.approval_round, d.approval_expires_at, d.title, d.content,
           d.metadata, d.embedding_model, d.embedding_provenance,
           d.active, d.published, d.deleted_at, d.tombstone_revision,
           d.updated_at
      from healthcare.ai_chat_documents d
     where (projection_filter is null or d.projection_kind = upper(projection_filter))
       and (source_types_filter is null or d.source_type = any(source_types_filter))
       and (include_deleted or d.deleted_at is null)
       and (
            (cursor_updated_at is null and cursor_id is null)
            or (
                cursor_updated_at is not null and cursor_id is not null
                and (
                    d.updated_at < cursor_updated_at
                    or (d.updated_at = cursor_updated_at and d.id < cursor_id)
                )
            )
       )
     order by d.updated_at desc, d.id desc
     limit least(greatest(coalesce(page_size, 500), 1), 500);
$$;

revoke all on function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
) from public, anon, authenticated;
grant execute on function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
) to service_role;

-- Vector keyset page for future retrieval workers.  Existing
-- match_chat_documents remains unchanged for backwards compatibility.
create or replace function healthcare.match_chat_documents_page(
    query_embedding extensions.vector(384),
    match_threshold real default 0.35,
    match_count integer default 5,
    source_types_filter text[] default null,
    projection_filter text default null,
    after_score real default null,
    after_id uuid default null
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
    embedding_model text,
    embedding_provenance text,
    active boolean,
    published boolean,
    updated_at timestamptz,
    score real
)
language sql
stable
security invoker
set search_path = healthcare, extensions, pg_catalog
as $$
    with ranked as (
        select d.id, d.source_type, d.source_id, d.title, d.content,
               d.metadata, d.projection_kind, d.content_revision,
               d.eligibility_revision, d.content_hash, d.approval_round,
               d.approval_expires_at, d.embedding_model,
               d.embedding_provenance, d.active, d.published, d.updated_at,
               (1 - (d.embedding <=> query_embedding))::real as score
          from healthcare.ai_chat_documents d
         where d.embedding is not null
           and d.active and d.published and d.deleted_at is null
           and (source_types_filter is null or d.source_type = any(source_types_filter))
           and (projection_filter is null or d.projection_kind = upper(projection_filter))
           and (
                d.projection_kind = 'OPERATIONAL'
                or (d.approval_round is not null and d.approval_expires_at > current_timestamp)
           )
    )
    select r.id, r.source_type, r.source_id, r.title, r.content, r.metadata,
           r.projection_kind, r.content_revision, r.eligibility_revision,
           r.content_hash, r.approval_round, r.approval_expires_at,
           r.embedding_model, r.embedding_provenance, r.active, r.published,
           r.updated_at, r.score
      from ranked r
     where r.score >= match_threshold
       and (
            after_score is null and after_id is null
            or (
                after_score is not null and after_id is not null
                and (r.score < after_score or (r.score = after_score and r.id > after_id))
            )
       )
     order by r.score desc, r.id
     limit least(greatest(coalesce(match_count, 5), 1), 20);
$$;

revoke all on function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
) from public, anon, authenticated;
grant execute on function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
) to service_role;

comment on column healthcare.ai_chat_documents.tombstone_revision is
    'Database-owned ineligibility revision; equal/older work cannot resurrect a tombstone.';
comment on function healthcare.list_chat_documents_page(text, text[], timestamptz, uuid, integer, boolean) is
    'Service-only keyset page for projection reconciliation; never exposes patient/history identities.';
comment on function healthcare.match_chat_documents_page(extensions.vector, real, integer, text[], text, real, uuid) is
    'Service-only vector keyset page; Spring remains the final clinical authorization authority.';

commit;
