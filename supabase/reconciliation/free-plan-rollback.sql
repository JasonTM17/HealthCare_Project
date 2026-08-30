-- Target-specific rollback for a committed reconciliation on the named
-- Supabase Free project. This is a new migration operation: it never rewrites
-- supabase_migrations.schema_migrations and it must not be run against another
-- project or after consumers have written new projection/catalog data.
--
-- Preconditions are intentionally strict. If any precondition fails, the
-- transaction aborts without dropping an object. Obtain a fresh snapshot and
-- investigate rather than weakening a guard.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = pg_catalog, extensions;

do $free_plan_rollback_preflight$
declare
    candidate_version_count integer;
    helper_oid oid;
    actual text;
    valid boolean;
begin
    select count(*)
      into candidate_version_count
      from supabase_migrations.schema_migrations
     where name = 'reconcile_hosted_clinical_projection_security';
    if candidate_version_count <> 1 then
        raise exception 'reconciliation migration history entry is missing or ambiguous';
    end if;

    if to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    ) is null
       or to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    ) is null then
        raise exception 'reconciliation pagination functions are not both present';
    end if;
    if not exists (
        select 1 from pg_trigger
         where tgrelid = 'healthcare.ai_chat_documents'::regclass
           and tgname = 'ai_chat_documents_tombstone_guard'
           and not tgisinternal
    ) then
        raise exception 'reconciliation tombstone trigger is missing';
    end if;

    if (select count(*) from healthcare.articles) <> 500
       or (select max(updated_at) from healthcare.articles)
          <> timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.specialties) <> 30
       or (select max(updated_at) from healthcare.specialties)
          <> timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.faqs) <> 150
       or (select max(updated_at) from healthcare.faqs)
          <> timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.ai_documents) <> 10000
       or (select count(*) from healthcare.ai_documents where source_type = 'branch') <> 0
       or (select max(updated_at) from healthcare.ai_documents)
          <> timestamptz '2026-08-24 10:48:53.018817+00'
       or (select count(*) from healthcare.ai_chat_documents) <> 830
       or (select count(*) from healthcare.ai_chat_documents where deleted_at is not null) <> 0
       or (select count(*) from healthcare.ai_chat_documents where tombstone_revision is not null) <> 0
       or (select max(updated_at) from healthcare.ai_chat_documents)
          <> timestamptz '2026-08-24 10:35:10.579576+00' then
        raise exception 'data changed after the Free-plan baseline; rollback is unsafe';
    end if;

    if exists (
        select 1 from healthcare.articles
         where content_language <> 'vi'
            or audience <> 'GENERAL'
            or topic_tags <> '[]'::jsonb
            or key_takeaways <> '[]'::jsonb
            or warning_signs <> '[]'::jsonb
            or prevention_tips <> '[]'::jsonb
            or when_to_seek_care is not null
            or source_references <> '[]'::jsonb
            or clinical_metadata <> '{}'::jsonb
            or clinical_disclaimer is not null
            or last_reviewed_at is not null
            or last_reviewed_by is not null
            or featured is not false
    ) or exists (
        select 1 from healthcare.specialties
         where clinical_overview is not null
            or common_conditions <> '[]'::jsonb
            or red_flags <> '[]'::jsonb
            or preventive_care <> '[]'::jsonb
            or when_to_seek_care is not null
            or source_references <> '[]'::jsonb
            or clinical_metadata <> '{}'::jsonb
            or last_reviewed_at is not null
            or last_reviewed_by is not null
    ) or exists (
        select 1 from healthcare.faqs
         where category is not null
            or audience <> 'GENERAL'
            or topic_tags <> '[]'::jsonb
            or related_specialty_slug is not null
            or source_references <> '[]'::jsonb
            or clinical_metadata <> '{}'::jsonb
            or clinical_disclaimer is not null
            or sort_order <> 0
            or last_reviewed_at is not null
            or last_reviewed_by is not null
    ) then
        raise exception 'new catalog columns contain post-apply data; rollback is unsafe';
    end if;

    select pg_get_constraintdef(c.oid), c.convalidated
      into actual, valid
      from pg_constraint c
     where c.conrelid = 'healthcare.ai_documents'::regclass
       and c.conname = 'ai_documents_source_type';
    if actual is null or not valid
       or position('branch' in lower(actual)) = 0 then
        raise exception 'post-apply source_type constraint is not present';
    end if;

    select p.oid
      into helper_oid
      from pg_proc p
     where p.oid = to_regprocedure('public.rls_auto_enable()');
    if helper_oid is null
       or not has_function_privilege('postgres', helper_oid, 'EXECUTE')
       or has_function_privilege('anon', helper_oid, 'EXECUTE')
       or has_function_privilege('authenticated', helper_oid, 'EXECUTE')
       or has_function_privilege('service_role', helper_oid, 'EXECUTE')
       or exists (
           select 1
             from pg_proc p
             cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
            where p.oid = helper_oid
              and acl.grantee <> p.proowner
              and acl.grantee <> coalesce((select oid from pg_roles where rolname = 'postgres'), 0)
       ) then
        raise exception 'platform helper is not in the restricted post-apply ACL shape';
    end if;
end
$free_plan_rollback_preflight$;

drop function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
);
drop function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
);

drop trigger ai_chat_documents_tombstone_guard
    on healthcare.ai_chat_documents;
drop function healthcare.ai_chat_documents_tombstone_guard();

drop index healthcare.ai_chat_documents_branch_cursor_idx;
drop index healthcare.ai_chat_documents_projection_cursor_idx;
drop index healthcare.healthcare_ai_documents_branch_idx;
drop index healthcare.healthcare_faqs_rich_related_specialty_idx;
drop index healthcare.healthcare_faqs_rich_topic_tags_idx;
drop index healthcare.healthcare_specialties_rich_conditions_idx;
drop index healthcare.healthcare_articles_rich_topic_tags_idx;

alter table healthcare.ai_chat_documents
    drop constraint ai_chat_documents_tombstone_shape;
alter table healthcare.articles
    drop constraint articles_rich_content_shape;
alter table healthcare.specialties
    drop constraint specialties_rich_content_shape;
alter table healthcare.faqs
    drop constraint faqs_rich_content_shape;

alter table healthcare.ai_chat_documents
    drop column tombstone_revision;
alter table healthcare.articles
    drop column content_language,
    drop column audience,
    drop column topic_tags,
    drop column key_takeaways,
    drop column warning_signs,
    drop column prevention_tips,
    drop column when_to_seek_care,
    drop column source_references,
    drop column clinical_metadata,
    drop column clinical_disclaimer,
    drop column last_reviewed_at,
    drop column last_reviewed_by,
    drop column featured;
alter table healthcare.specialties
    drop column clinical_overview,
    drop column common_conditions,
    drop column red_flags,
    drop column preventive_care,
    drop column when_to_seek_care,
    drop column source_references,
    drop column clinical_metadata,
    drop column last_reviewed_at,
    drop column last_reviewed_by;
alter table healthcare.faqs
    drop column category,
    drop column audience,
    drop column topic_tags,
    drop column related_specialty_slug,
    drop column source_references,
    drop column clinical_metadata,
    drop column clinical_disclaimer,
    drop column sort_order,
    drop column last_reviewed_at,
    drop column last_reviewed_by;

alter table healthcare.ai_documents
    drop constraint ai_documents_source_type;
alter table healthcare.ai_documents
    add constraint ai_documents_source_type check (
        source_type in ('specialty', 'doctor', 'service', 'package', 'article', 'faq')
    ) not valid;
alter table healthcare.ai_documents
    validate constraint ai_documents_source_type;

-- Keep the platform helper in the safer post-apply state. Reopening a public
-- SECURITY DEFINER RPC is not required to undo the healthcare projection and
-- would reintroduce the Supabase security-advisor warning. Ownership remains
-- postgres; no migration-history row is rewritten.

do $free_plan_rollback_postconditions$
declare
    actual text;
    valid boolean;
begin
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'articles'
           and column_name in (
               'content_language', 'audience', 'topic_tags', 'key_takeaways',
               'warning_signs', 'prevention_tips', 'when_to_seek_care',
               'source_references', 'clinical_metadata', 'clinical_disclaimer',
               'last_reviewed_at', 'last_reviewed_by', 'featured'
           )
    ) or exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'specialties'
           and column_name in (
               'clinical_overview', 'common_conditions', 'red_flags',
               'preventive_care', 'when_to_seek_care', 'source_references',
               'clinical_metadata', 'last_reviewed_at', 'last_reviewed_by'
           )
    ) or exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'faqs'
           and column_name in (
               'category', 'audience', 'topic_tags', 'related_specialty_slug',
               'source_references', 'clinical_metadata', 'clinical_disclaimer',
               'sort_order', 'last_reviewed_at', 'last_reviewed_by'
           )
    ) or exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'ai_chat_documents'
           and column_name = 'tombstone_revision'
    ) then
        raise exception 'Free-plan rollback left reconciliation columns';
    end if;
    if to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    ) is not null
       or to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    ) is not null
       or exists (
           select 1 from pg_trigger
            where tgrelid = 'healthcare.ai_chat_documents'::regclass
              and tgname = 'ai_chat_documents_tombstone_guard'
              and not tgisinternal
       ) then
        raise exception 'Free-plan rollback left reconciliation routines';
    end if;
    select pg_get_constraintdef(c.oid), c.convalidated
      into actual, valid
      from pg_constraint c
     where c.conrelid = 'healthcare.ai_documents'::regclass
       and c.conname = 'ai_documents_source_type';
    if not valid
       or regexp_replace(lower(actual), '\s+', '', 'g')
          <> regexp_replace(lower(
              'CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'
          ), '\s+', '', 'g') then
        raise exception 'baseline source_type constraint was not restored';
    end if;
    if has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
       or has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')
       or not has_function_privilege('postgres', 'public.rls_auto_enable()', 'EXECUTE')
       or obj_description('public.rls_auto_enable()'::regprocedure, 'pg_proc')
          <> 'Internal DDL event trigger; execution is restricted to postgres.' then
        raise exception 'platform helper secure ACL/comment was not preserved';
    end if;
end
$free_plan_rollback_postconditions$;

commit;
