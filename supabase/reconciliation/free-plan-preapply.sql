-- Read-only gate for the named Supabase Free project.
--
-- This is deliberately not a migration. Run it immediately before
-- 20260830102500_reconcile_hosted_clinical_projection_security. It proves the
-- baseline captured in free-plan-baseline-20260830.json is still present. A
-- result without an exception is the only acceptable pre-apply signal.
--
-- The URL/ref is verified by the operator through the Supabase management
-- surface before this SQL is sent. SQL cannot discover a Supabase project ref,
-- so this gate additionally binds the session to the captured PostgreSQL
-- system_identifier. A literal SELECT of the expected ref is not a target
-- check.

begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = pg_catalog, extensions;

do $free_plan_preapply$
declare
    versions text[];
    system_identifier text;
    fingerprint text;
    actual text;
    helper_oid oid;
    helper_acl text;
    helper_comment text;
    expected record;
    expected_columns text[] := array[
        'articles.content_language', 'articles.audience',
        'articles.topic_tags', 'articles.key_takeaways',
        'articles.warning_signs', 'articles.prevention_tips',
        'articles.when_to_seek_care', 'articles.source_references',
        'articles.clinical_metadata', 'articles.clinical_disclaimer',
        'articles.last_reviewed_at', 'articles.last_reviewed_by',
        'articles.featured', 'specialties.clinical_overview',
        'specialties.common_conditions', 'specialties.red_flags',
        'specialties.preventive_care', 'specialties.when_to_seek_care',
        'specialties.source_references', 'specialties.clinical_metadata',
        'specialties.last_reviewed_at', 'specialties.last_reviewed_by',
        'faqs.category', 'faqs.audience', 'faqs.topic_tags',
        'faqs.related_specialty_slug', 'faqs.source_references',
        'faqs.clinical_metadata', 'faqs.clinical_disclaimer',
        'faqs.sort_order', 'faqs.last_reviewed_at', 'faqs.last_reviewed_by',
        'ai_chat_documents.tombstone_revision'
    ];
    item text;
begin
    select pcs.system_identifier::text
      into system_identifier
      from pg_control_system() pcs;
    if system_identifier <> '7666007964130682852' then
        raise exception 'PostgreSQL system identifier does not match the named Supabase target';
    end if;

    if current_schema() is null then
        raise exception 'unable to resolve current schema';
    end if;

    select array_agg(format('%s:%s', sm.version, coalesce(sm.name, '')) order by sm.version::text)
      into versions
      from supabase_migrations.schema_migrations sm;
    if versions is distinct from array[
        '20260823085754:healthcare_data_platform',
        '20260823085812:enforce_spring_identity_authority',
        '20260823102718:big_data_vector_contract',
        '20260824102515:patient_chat_projection_contract'
    ]::text[] then
        raise exception 'migration history/name drifted before Free-plan apply';
    end if;

    foreach item in array expected_columns loop
        if exists (
            select 1
              from information_schema.columns c
             where c.table_schema = 'healthcare'
               and format('%s.%s', c.table_name, c.column_name) = item
        ) then
            raise exception 'candidate column already exists: %', item;
        end if;
    end loop;

    if to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    ) is not null
       or to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    ) is not null then
        raise exception 'candidate pagination function already exists';
    end if;

    if to_regprocedure('healthcare.ai_chat_documents_tombstone_guard()') is not null then
        raise exception 'candidate tombstone guard function already exists';
    end if;

    if exists (
        select 1 from pg_trigger
         where tgrelid = 'healthcare.ai_chat_documents'::regclass
           and tgname = 'ai_chat_documents_tombstone_guard'
           and not tgisinternal
    ) then
        raise exception 'candidate tombstone trigger already exists';
    end if;

    if exists (
        select 1 from pg_constraint
         where conrelid in (
             'healthcare.articles'::regclass,
             'healthcare.specialties'::regclass,
             'healthcare.faqs'::regclass,
             'healthcare.ai_chat_documents'::regclass
         )
           and conname in (
             'articles_rich_content_shape',
             'specialties_rich_content_shape',
             'faqs_rich_content_shape',
             'ai_chat_documents_tombstone_shape'
         )
    ) then
        raise exception 'candidate reconciliation constraint already exists';
    end if;

    if exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'healthcare'
          and c.relname in (
              'healthcare_articles_rich_topic_tags_idx',
              'healthcare_specialties_rich_conditions_idx',
              'healthcare_faqs_rich_topic_tags_idx',
              'healthcare_faqs_rich_related_specialty_idx',
              'healthcare_ai_documents_branch_idx',
              'ai_chat_documents_projection_cursor_idx',
              'ai_chat_documents_branch_cursor_idx'
          )
    ) then
        raise exception 'candidate reconciliation index already exists';
    end if;

    select pg_get_constraintdef(c.oid), c.convalidated
      into actual, item
      from pg_constraint c
     where c.conrelid = 'healthcare.ai_documents'::regclass
       and c.conname = 'ai_documents_source_type';
    if actual is null or item::boolean is not true
       or regexp_replace(lower(actual), '\s+', '', 'g')
          <> regexp_replace(lower(
              'CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'
          ), '\s+', '', 'g') then
        raise exception 'baseline ai_documents source constraint drifted';
    end if;

    select p.oid, coalesce(p.proacl::text, '<NULL>'), obj_description(p.oid, 'pg_proc')
      into helper_oid, helper_acl, helper_comment
      from pg_proc p
     where p.oid = to_regprocedure('public.rls_auto_enable()');
    if helper_oid is null
       or pg_get_userbyid((select proowner from pg_proc where oid = helper_oid)) <> 'postgres'
       or helper_acl <> '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
       or helper_comment is not null
       or not has_function_privilege('anon', helper_oid, 'EXECUTE')
       or not has_function_privilege('authenticated', helper_oid, 'EXECUTE')
       or not has_function_privilege('service_role', helper_oid, 'EXECUTE')
       or not has_function_privilege('postgres', helper_oid, 'EXECUTE') then
        raise exception 'public.rls_auto_enable baseline ACL/comment drifted';
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
       or (select max(updated_at) from healthcare.ai_chat_documents)
          <> timestamptz '2026-08-24 10:35:10.579576+00' then
         raise exception 'baseline row counts or update watermarks drifted';
    end if;

    -- Include xmin in the ordered row fingerprint. Any post-snapshot update,
    -- including an update that writes a default value, fails closed. A vacuum
    -- freeze also fails closed rather than permitting an uncertain rollback.
    for expected in
        select * from (values
            ('articles', '9ecf3b45b518f9a505bd77b1a8e2529b', '{}'::text[]),
            ('specialties', '80c44b33331823193c04a67863effb59', '{}'::text[]),
            ('faqs', '0437a1dbbb5d28da2a2ab7c961d2feb2', '{}'::text[]),
            ('ai_documents', '0f3aea1fd31021b4ddf7666aaef27d64', '{}'::text[]),
            ('ai_chat_documents', '22f69fa4e6336e41d4e6fa2f66ddefa4', '{}'::text[])
        ) as baseline(table_name, expected_fingerprint, excluded_columns)
    loop
        execute format(
            'select md5(coalesce(string_agg(xmin::text || '':'' || md5((to_jsonb(t) - $1::text[])::text), '''' order by id), '''')) from healthcare.%I t',
            expected.table_name
        ) into fingerprint using expected.excluded_columns;
        if fingerprint <> expected.expected_fingerprint then
            raise exception 'baseline row fingerprint drifted for healthcare.%', expected.table_name;
        end if;
    end loop;
end
$free_plan_preapply$;

select 'FREE_PLAN_PREAPPLY_OK' as gate,
       'awaknzhadjglbfkhigck' as expected_project_ref,
       (select count(*) from healthcare.ai_chat_documents) as chat_rows,
       (select count(*) from healthcare.ai_documents) as rag_rows;

rollback;
