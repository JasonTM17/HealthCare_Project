-- HealthCare Supabase data platform (additive, Supabase-native schema).
--
-- This migration intentionally lives in the `healthcare` schema instead of
-- replacing the Spring/Flyway `public` tables. The current backend still owns
-- public V1-V24 migrations; the bridge can be introduced later without making
-- a Supabase reset incompatible with Flyway.

create schema if not exists healthcare;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

revoke create on schema healthcare from public;
grant usage on schema healthcare to anon, authenticated, service_role;

create table healthcare.specialties (
    id uuid primary key default extensions.gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    common_symptoms jsonb not null default '[]'::jsonb,
    preparation_steps jsonb not null default '[]'::jsonb,
    care_pathway text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint specialties_common_symptoms_object check (jsonb_typeof(common_symptoms) = 'array'),
    constraint specialties_preparation_steps_array check (jsonb_typeof(preparation_steps) = 'array')
);

create table healthcare.branches (
    id uuid primary key default extensions.gen_random_uuid(),
    name text not null,
    slug text not null unique,
    address text not null,
    phone text,
    working_hours text,
    emergency_hotline text,
    map_url text,
    amenities jsonb not null default '[]'::jsonb,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint branches_amenities_array check (jsonb_typeof(amenities) = 'array')
);

create table healthcare.doctors (
    id uuid primary key default extensions.gen_random_uuid(),
    full_name text not null,
    slug text not null unique,
    bio text,
    photo_url text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table healthcare.services (
    id uuid primary key default extensions.gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table healthcare.packages (
    id uuid primary key default extensions.gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    price numeric(12, 2) not null check (price >= 0),
    target_audience text,
    duration_days integer check (duration_days is null or duration_days > 0),
    checklist jsonb not null default '[]'::jsonb,
    preparation_steps jsonb not null default '[]'::jsonb,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint packages_checklist_array check (jsonb_typeof(checklist) = 'array'),
    constraint packages_preparation_steps_array check (jsonb_typeof(preparation_steps) = 'array')
);

create table healthcare.articles (
    id uuid primary key default extensions.gen_random_uuid(),
    title text not null,
    slug text not null unique,
    summary text,
    body text,
    published_at timestamptz,
    category text,
    author_name text,
    reading_minutes integer check (reading_minutes is null or reading_minutes > 0),
    related_specialty_slug text,
    sections jsonb not null default '[]'::jsonb,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint articles_sections_array check (jsonb_typeof(sections) = 'array')
);

create table healthcare.faqs (
    id uuid primary key default extensions.gen_random_uuid(),
    question text not null,
    answer text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table healthcare.doctor_specialties (
    id uuid primary key default extensions.gen_random_uuid(),
    doctor_id uuid not null references healthcare.doctors(id) on delete cascade,
    specialty_id uuid not null references healthcare.specialties(id) on delete restrict,
    created_at timestamptz not null default now(),
    unique (doctor_id, specialty_id)
);

create table healthcare.doctor_branches (
    id uuid primary key default extensions.gen_random_uuid(),
    doctor_id uuid not null references healthcare.doctors(id) on delete cascade,
    branch_id uuid not null references healthcare.branches(id) on delete restrict,
    created_at timestamptz not null default now(),
    unique (doctor_id, branch_id)
);

-- `customers` and `patient_profiles` are server-managed synthetic analytical
-- mirrors. `legacy_*` values preserve deterministic Spring seed identifiers
-- without giving Supabase any account, login, or authorization authority.
create table healthcare.customers (
    id uuid primary key default extensions.gen_random_uuid(),
    customer_code text not null unique,
    legacy_user_id uuid,
    -- Retained only so the existing synthetic seed can insert its explicit NULL.
    -- The check constraint prevents this compatibility field becoming a link.
    auth_user_id uuid,
    full_name text not null,
    email text,
    phone text not null,
    status text not null default 'ACTIVE',
    synthetic boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint customers_status check (status in ('ACTIVE', 'DISABLED', 'PENDING')),
    constraint customers_synthetic_only check (synthetic),
    constraint customers_no_supabase_auth_link check (auth_user_id is null)
);

create table healthcare.patient_profiles (
    id uuid primary key default extensions.gen_random_uuid(),
    customer_id uuid not null unique references healthcare.customers(id) on delete cascade,
    legacy_patient_profile_id uuid,
    date_of_birth date,
    gender text not null default 'UNSPECIFIED',
    address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint patient_profiles_gender check (gender in ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'))
);

-- One row per source identity, matching the current FastAPI RAG contract
-- (`source_type:source_id`). The current local embedder emits 384 dimensions;
-- remote models must be introduced with a deliberate dimension migration.
create table healthcare.ai_documents (
    id uuid primary key default extensions.gen_random_uuid(),
    source_type text not null,
    source_id text not null,
    title text not null,
    content text not null,
    metadata jsonb not null default '{}'::jsonb,
    embedding extensions.vector(384),
    embedding_model text not null default 'local-hash',
    embedding_provenance text not null default 'local_provider',
    content_hash text not null,
    sync_revision bigint not null default 0,
    active boolean not null default true,
    published boolean not null default true,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    search_vector tsvector generated always as (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) stored,
    constraint ai_documents_source_type check (
        source_type in ('specialty', 'doctor', 'service', 'package', 'article', 'faq')
    ),
    constraint ai_documents_source_id check (
        source_id ~ '^[A-Za-z0-9._:-]+$' and length(source_id) between 1 and 200
    ),
    constraint ai_documents_content_size check (length(content) between 1 and 20000),
    constraint ai_documents_metadata_object check (jsonb_typeof(metadata) = 'object'),
    constraint ai_documents_provenance check (
        embedding_provenance in ('local_provider', 'remote_provider', 'local_fallback')
    ),
    unique (source_type, source_id)
);

create or replace function healthcare.touch_updated_at()
returns trigger
language plpgsql
set search_path = healthcare
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke execute on function healthcare.touch_updated_at() from public, anon, authenticated;

create trigger specialties_touch_updated_at before update on healthcare.specialties
for each row execute function healthcare.touch_updated_at();
create trigger branches_touch_updated_at before update on healthcare.branches
for each row execute function healthcare.touch_updated_at();
create trigger doctors_touch_updated_at before update on healthcare.doctors
for each row execute function healthcare.touch_updated_at();
create trigger services_touch_updated_at before update on healthcare.services
for each row execute function healthcare.touch_updated_at();
create trigger packages_touch_updated_at before update on healthcare.packages
for each row execute function healthcare.touch_updated_at();
create trigger articles_touch_updated_at before update on healthcare.articles
for each row execute function healthcare.touch_updated_at();
create trigger faqs_touch_updated_at before update on healthcare.faqs
for each row execute function healthcare.touch_updated_at();
create trigger customers_touch_updated_at before update on healthcare.customers
for each row execute function healthcare.touch_updated_at();
create trigger patient_profiles_touch_updated_at before update on healthcare.patient_profiles
for each row execute function healthcare.touch_updated_at();
create trigger ai_documents_touch_updated_at before update on healthcare.ai_documents
for each row execute function healthcare.touch_updated_at();

-- Foreign keys and RLS predicates need explicit indexes in Postgres.
create index doctor_specialties_specialty_id_idx on healthcare.doctor_specialties(specialty_id);
create index doctor_branches_branch_id_idx on healthcare.doctor_branches(branch_id);
create index customers_legacy_user_id_idx on healthcare.customers(legacy_user_id);
create unique index customers_email_lower_uq on healthcare.customers(lower(email)) where email is not null;
create unique index customers_phone_uq on healthcare.customers(phone);
create index patient_profiles_legacy_id_idx on healthcare.patient_profiles(legacy_patient_profile_id);
create index articles_related_specialty_idx on healthcare.articles(related_specialty_slug);
create index specialties_active_idx on healthcare.specialties(active) where active;
create index branches_active_idx on healthcare.branches(active) where active;
create index doctors_active_idx on healthcare.doctors(active) where active;
create index services_active_idx on healthcare.services(active) where active;
create index packages_active_idx on healthcare.packages(active) where active;
create index articles_active_published_idx on healthcare.articles(published_at desc) where active and published_at is not null;
create index faqs_active_idx on healthcare.faqs(active) where active;
create index ai_documents_public_source_idx on healthcare.ai_documents(source_type, source_id)
where active and published and deleted_at is null;
create index ai_documents_metadata_gin_idx on healthcare.ai_documents using gin(metadata);
create index ai_documents_search_vector_idx on healthcare.ai_documents using gin(search_vector);
create index ai_documents_embedding_hnsw_idx on healthcare.ai_documents
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null and active and published and deleted_at is null;

-- Deterministic fixture vectors make local reset/search smoke tests useful
-- without pretending that a hash vector is a clinical-quality embedding. A
-- trusted embedding worker should replace these rows before any real ranking
-- claim is made.
create or replace function healthcare.synthetic_embedding(seed text)
returns extensions.vector(384)
language sql
immutable
parallel safe
set search_path = healthcare, extensions
as $$
    select (
        '[' || string_agg(
            (
                (get_byte(decode(md5(seed || ':' || dimension::text), 'hex'), 0) - 128)
                / 128.0
            )::text,
            ',' order by dimension
        ) || ']'
    )::extensions.vector(384)
    from generate_series(0, 383) as dimensions(dimension);
$$;

revoke execute on function healthcare.synthetic_embedding(text) from public, anon, authenticated;

alter table healthcare.specialties enable row level security;
alter table healthcare.branches enable row level security;
alter table healthcare.doctors enable row level security;
alter table healthcare.services enable row level security;
alter table healthcare.packages enable row level security;
alter table healthcare.articles enable row level security;
alter table healthcare.faqs enable row level security;
alter table healthcare.doctor_specialties enable row level security;
alter table healthcare.doctor_branches enable row level security;
alter table healthcare.customers enable row level security;
alter table healthcare.patient_profiles enable row level security;
alter table healthcare.ai_documents enable row level security;

create policy specialties_public_read on healthcare.specialties
for select to anon, authenticated using (active);
create policy branches_public_read on healthcare.branches
for select to anon, authenticated using (active);
create policy doctors_public_read on healthcare.doctors
for select to anon, authenticated using (active);
create policy services_public_read on healthcare.services
for select to anon, authenticated using (active);
create policy packages_public_read on healthcare.packages
for select to anon, authenticated using (active);
create policy articles_public_read on healthcare.articles
for select to anon, authenticated using (active and published_at is not null);
create policy faqs_public_read on healthcare.faqs
for select to anon, authenticated using (active);
create policy doctor_specialties_public_read on healthcare.doctor_specialties
for select to anon, authenticated
using (exists (select 1 from healthcare.doctors d where d.id = doctor_id and d.active)
   and exists (select 1 from healthcare.specialties s where s.id = specialty_id and s.active));
create policy doctor_branches_public_read on healthcare.doctor_branches
for select to anon, authenticated
using (exists (select 1 from healthcare.doctors d where d.id = doctor_id and d.active)
   and exists (select 1 from healthcare.branches b where b.id = branch_id and b.active));

-- The synthetic mirrors are server-only from their first migration state. RLS
-- remains enabled as defense in depth, with no browser-role policies.
revoke all privileges on table healthcare.customers, healthcare.patient_profiles
from anon, authenticated;

create policy ai_documents_public_read on healthcare.ai_documents
for select to anon, authenticated
using (active and published and deleted_at is null);

-- New Supabase projects do not automatically expose newly created tables.
-- These grants expose only the read paths protected by the policies above.
grant select on
    healthcare.specialties,
    healthcare.branches,
    healthcare.doctors,
    healthcare.services,
    healthcare.packages,
    healthcare.articles,
    healthcare.faqs,
    healthcare.doctor_specialties,
    healthcare.doctor_branches,
    healthcare.ai_documents
to anon, authenticated;
grant all privileges on all tables in schema healthcare to service_role;

-- PostgREST cannot express pgvector operators directly; expose a bounded RPC.
-- The function is SECURITY INVOKER by default, so the ai_documents RLS policy
-- still applies to anonymous and authenticated callers.
create or replace function healthcare.match_documents(
    query_embedding extensions.vector(384),
    match_threshold real default 0.35,
    match_count integer default 5,
    filter_source_types text[] default null,
    query_text text default ''
)
returns table (
    id uuid,
    source_type text,
    source_id text,
    title text,
    content text,
    metadata jsonb,
    score real
)
language sql
stable
set search_path = healthcare, extensions
as $$
    select
        d.id,
        d.source_type,
        d.source_id,
        d.title,
        d.content,
        d.metadata,
        (
            0.75 * (1 - (d.embedding <=> query_embedding))
            + case
                when nullif(btrim(coalesce(query_text, '')), '') is null then 0
                else 0.25 * least(
                    ts_rank_cd(
                        d.search_vector,
                        websearch_to_tsquery('simple', left(query_text, 10000))
                    ),
                    1
                )
              end
        )::real as score
    from healthcare.ai_documents d
    where d.embedding is not null
      and d.active
      and d.published
      and d.deleted_at is null
      and (filter_source_types is null or d.source_type = any(filter_source_types))
      and (1 - (d.embedding <=> query_embedding)) >= greatest(least(match_threshold, 1), -1)
    order by d.embedding <=> query_embedding
    limit least(greatest(match_count, 1), 20);
$$;

grant execute on function healthcare.match_documents(extensions.vector(384), real, integer, text[], text)
to anon, authenticated, service_role;

comment on schema healthcare is 'Supabase-native HealthCare catalog, synthetic analytical mirrors, and AI retrieval data';
comment on table healthcare.customers is
    'Server-managed synthetic customer mirror; Spring PostgreSQL is the identity authority';
comment on column healthcare.customers.auth_user_id is
    'Null-only seed compatibility field; never an authentication, correlation, or authorization link';
comment on table healthcare.patient_profiles is
    'Server-managed synthetic profile mirror; never exposed directly to browser roles';
comment on table healthcare.ai_documents is 'Public catalog knowledge only; never store patient clinical records here';
comment on column healthcare.ai_documents.embedding is '384-dim vector matching apps/ai-service local-hash or a compatible model';
