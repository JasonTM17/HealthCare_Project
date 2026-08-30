-- Read-only gate for re-applying the reviewed reconciliation after the
-- target-specific rollback and helper-hardening migrations have been recorded.
--
-- This exact state exists only because the first provider apply was followed by
-- a separately recorded rollback and helper-hardening migration. It is
-- intentional that this gate accepts those three audit rows and no other
-- history drift. Run it immediately before a separate apply_migration call;
-- never concatenate the forward and rollback SQL in one execute_sql request.

begin transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $free_plan_reapply_preapply$
declare
    history text[];
    helper_oid oid;
    helper_owner name;
    helper_acl text;
    helper_comment text;
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
    select array_agg(format('%s:%s', version, coalesce(name, '')) order by version)
      into history
      from supabase_migrations.schema_migrations;
    if history is distinct from array[
        '20260823085754:healthcare_data_platform',
        '20260823085812:enforce_spring_identity_authority',
        '20260823102718:big_data_vector_contract',
        '20260824102515:patient_chat_projection_contract',
        '20260830075505:reconcile_hosted_clinical_projection_security',
        '20260830075737:rollback_free_plan_reconciliation_20260830',
        '20260830080646:lock_down_public_event_trigger_free_plan_20260830'
    ]::text[] then
        raise exception 'Free-plan reapply history is not the reviewed seven-row state';
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
    ) is not null
       or to_regprocedure('healthcare.ai_chat_documents_tombstone_guard()') is not null then
        raise exception 'candidate reconciliation routines already exist';
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

    if not exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'healthcare.ai_documents'::regclass
           and c.conname = 'ai_documents_source_type'
           and c.convalidated
           and regexp_replace(lower(pg_get_constraintdef(c.oid)), '\s+', '', 'g')
             = regexp_replace(lower(
                 'CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'
             ), '\s+', '', 'g')
    ) then
        raise exception 'baseline ai_documents source constraint drifted';
    end if;

    select p.oid, pg_get_userbyid(p.proowner), coalesce(p.proacl::text, '<NULL>'),
           obj_description(p.oid, 'pg_proc')
      into helper_oid, helper_owner, helper_acl, helper_comment
      from pg_proc p
     where p.oid = to_regprocedure('public.rls_auto_enable()');
    if helper_oid is null
       or helper_owner <> 'postgres'
       or helper_acl = '<NULL>'
       or has_function_privilege('anon', helper_oid, 'EXECUTE')
       or has_function_privilege('authenticated', helper_oid, 'EXECUTE')
       or has_function_privilege('service_role', helper_oid, 'EXECUTE')
       or not has_function_privilege('postgres', helper_oid, 'EXECUTE')
       or helper_comment <> 'Internal DDL event trigger; execution is restricted to postgres.' then
        raise exception 'public.rls_auto_enable hardened ACL/comment drifted';
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
end
$free_plan_reapply_preapply$;

select 'FREE_PLAN_REAPPLY_PREAPPLY_OK' as gate,
       'awaknzhadjglbfkhigck' as expected_project_ref,
       (select count(*) from healthcare.ai_chat_documents) as chat_rows,
       (select count(*) from healthcare.ai_documents) as rag_rows;

rollback;
