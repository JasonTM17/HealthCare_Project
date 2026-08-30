-- Target-specific compensating rollback for
-- reconcile_hosted_clinical_projection_security_writer_lock_20260830.
--
-- This is deliberately bound to the exact Supabase Free target, migration
-- ledger, object fingerprints, and unchanged post-apply rows observed on
-- 2026-08-30. It is not a generic down migration and it never rewrites the
-- provider migration history. Apply it only after a fresh writer freeze and
-- an independent review of the current target state.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = pg_catalog, extensions;

-- Keep this order identical to the forward migration. A writer either drains
-- before the lock or the bounded timeout aborts before any destructive DDL.
lock table healthcare.articles,
           healthcare.specialties,
           healthcare.faqs,
           healthcare.ai_documents,
           healthcare.ai_chat_documents
    in access exclusive mode;

do $rollback_preflight$
declare
    history text[];
    expected record;
    actual_type text;
    actual_nullable text;
    definition text;
    valid boolean;
    fingerprint text;
    system_identifier text;
    helper_oid oid;
    helper_owner name;
    helper_acl text;
    helper_comment text;
begin
    select pcs.system_identifier::text into system_identifier
      from pg_control_system() pcs;
    if system_identifier <> '7666007964130682852' then
        raise exception 'PostgreSQL system identifier does not match the named target';
    end if;

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
        '20260830080646:lock_down_public_event_trigger_free_plan_20260830',
        '20260830143140:reconcile_hosted_clinical_projection_security_writer_lock_20260830'
    ]::text[] then
        raise exception 'rollback history is not the exact observed eight-row state';
    end if;

    -- Names are not provenance; bind every audited row to its one-statement
    -- provider fingerprint, including the writer-lock apply.
    for expected in
        select * from (values
            ('20260823085754','healthcare_data_platform','b250335002f342d24a159b68233c9678'),
            ('20260823085812','enforce_spring_identity_authority','2728f8523aba6a06d69c33b3e7566514'),
            ('20260823102718','big_data_vector_contract','ff32a68acbde44fece83c77c8f8add83'),
            ('20260824102515','patient_chat_projection_contract','ced22e7f4873c86495fd0010092e49a2'),
            ('20260830075505','reconcile_hosted_clinical_projection_security','a6be7e503ca7505a07a7df4fe864e9b0'),
            ('20260830075737','rollback_free_plan_reconciliation_20260830','9d091b4911befb714b7a3adec6aa17f9'),
            ('20260830080646','lock_down_public_event_trigger_free_plan_20260830','1cd1aa7d221ac68192ed052be5eb8071'),
            ('20260830143140','reconcile_hosted_clinical_projection_security_writer_lock_20260830','141b596b4ebe0867cda9a7d6a1311b82')
        ) as recorded(version, migration_name, expected_hash)
    loop
        if not exists (
            select 1 from supabase_migrations.schema_migrations sm
             where sm.version = expected.version
               and sm.name = expected.migration_name
               and array_length(sm.statements, 1) = 1
               and md5(sm.statements[1]) = expected.expected_hash
        ) then
            raise exception 'migration statement fingerprint drifted for %', expected.migration_name;
        end if;
    end loop;

    -- The forward apply was proven against an absent candidate set. Refuse to
    -- drop any object if another operation recreated or changed its shape.
    for expected in
        select * from (values
            ('articles','content_language','text','NO'),('articles','audience','text','NO'),
            ('articles','topic_tags','jsonb','NO'),('articles','key_takeaways','jsonb','NO'),
            ('articles','warning_signs','jsonb','NO'),('articles','prevention_tips','jsonb','NO'),
            ('articles','when_to_seek_care','text','YES'),('articles','source_references','jsonb','NO'),
            ('articles','clinical_metadata','jsonb','NO'),('articles','clinical_disclaimer','text','YES'),
            ('articles','last_reviewed_at','timestamp with time zone','YES'),('articles','last_reviewed_by','text','YES'),
            ('articles','featured','boolean','NO'),
            ('specialties','clinical_overview','text','YES'),('specialties','common_conditions','jsonb','NO'),
            ('specialties','red_flags','jsonb','NO'),('specialties','preventive_care','jsonb','NO'),
            ('specialties','when_to_seek_care','text','YES'),('specialties','source_references','jsonb','NO'),
            ('specialties','clinical_metadata','jsonb','NO'),('specialties','last_reviewed_at','timestamp with time zone','YES'),
            ('specialties','last_reviewed_by','text','YES'),
            ('faqs','category','text','YES'),('faqs','audience','text','NO'),('faqs','topic_tags','jsonb','NO'),
            ('faqs','related_specialty_slug','text','YES'),('faqs','source_references','jsonb','NO'),
            ('faqs','clinical_metadata','jsonb','NO'),('faqs','clinical_disclaimer','text','YES'),
            ('faqs','sort_order','integer','NO'),('faqs','last_reviewed_at','timestamp with time zone','YES'),
            ('faqs','last_reviewed_by','text','YES'),('ai_chat_documents','tombstone_revision','bigint','YES')
        ) as required(table_name,column_name,data_type,is_nullable)
    loop
        select c.data_type,c.is_nullable into actual_type,actual_nullable
          from information_schema.columns c
         where c.table_schema='healthcare'
           and c.table_name=expected.table_name
           and c.column_name=expected.column_name;
        if actual_type is null or actual_type <> expected.data_type
           or actual_nullable <> expected.is_nullable then
            raise exception 'candidate column definition drifted for healthcare.%.%', expected.table_name, expected.column_name;
        end if;
    end loop;

    for expected in
        select * from (values
            ('articles','articles_rich_content_shape','CHECK (((content_language ~ ''^[a-z]{2}(-[A-Z]{2})?$''::text) AND (audience = ANY (ARRAY[''GENERAL''::text, ''PATIENT''::text, ''CAREGIVER''::text, ''PROFESSIONAL''::text])) AND (jsonb_typeof(topic_tags) = ''array''::text) AND (jsonb_typeof(key_takeaways) = ''array''::text) AND (jsonb_typeof(warning_signs) = ''array''::text) AND (jsonb_typeof(prevention_tips) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536)))'),
            ('specialties','specialties_rich_content_shape','CHECK (((jsonb_typeof(common_conditions) = ''array''::text) AND (jsonb_typeof(red_flags) = ''array''::text) AND (jsonb_typeof(preventive_care) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536)))'),
            ('faqs','faqs_rich_content_shape','CHECK (((audience = ANY (ARRAY[''GENERAL''::text, ''PATIENT''::text, ''CAREGIVER''::text, ''PROFESSIONAL''::text])) AND (jsonb_typeof(topic_tags) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536) AND (sort_order >= 0)))'),
            ('ai_chat_documents','ai_chat_documents_tombstone_shape','CHECK ((((deleted_at IS NULL) AND (tombstone_revision IS NULL)) OR ((deleted_at IS NOT NULL) AND (tombstone_revision IS NOT NULL) AND (tombstone_revision > 0))))')
        ) as required(table_name,constraint_name,expected_definition)
    loop
        select pg_get_constraintdef(c.oid),c.convalidated into definition,valid
          from pg_constraint c
         where c.conrelid=format('healthcare.%s',expected.table_name)::regclass
           and c.conname=expected.constraint_name;
        if definition is null or not valid
           or regexp_replace(lower(definition),'\s+','','g') <> regexp_replace(lower(expected.expected_definition),'\s+','','g') then
            raise exception 'reconciliation constraint definition drifted for %', expected.constraint_name;
        end if;
    end loop;

    for expected in
        select * from (values
            ('healthcare_articles_rich_topic_tags_idx','CREATE INDEX healthcare_articles_rich_topic_tags_idx ON healthcare.articles USING gin (topic_tags)'),
            ('healthcare_specialties_rich_conditions_idx','CREATE INDEX healthcare_specialties_rich_conditions_idx ON healthcare.specialties USING gin (common_conditions)'),
            ('healthcare_faqs_rich_topic_tags_idx','CREATE INDEX healthcare_faqs_rich_topic_tags_idx ON healthcare.faqs USING gin (topic_tags)'),
            ('healthcare_faqs_rich_related_specialty_idx','CREATE INDEX healthcare_faqs_rich_related_specialty_idx ON healthcare.faqs USING btree (related_specialty_slug) WHERE active'),
            ('healthcare_ai_documents_branch_idx','CREATE INDEX healthcare_ai_documents_branch_idx ON healthcare.ai_documents USING btree (source_type, source_id) WHERE ((source_type = ''branch''::text) AND active AND published AND (deleted_at IS NULL))'),
            ('ai_chat_documents_projection_cursor_idx','CREATE INDEX ai_chat_documents_projection_cursor_idx ON healthcare.ai_chat_documents USING btree (projection_kind, updated_at DESC, id DESC)'),
            ('ai_chat_documents_branch_cursor_idx','CREATE INDEX ai_chat_documents_branch_cursor_idx ON healthcare.ai_chat_documents USING btree (updated_at DESC, id DESC) WHERE ((projection_kind = ''OPERATIONAL''::text) AND (source_type = ''branch''::text))')
        ) as required(index_name,expected_definition)
    loop
        select i.indexdef,x.indisvalid and x.indisready into definition,valid
          from pg_indexes i join pg_class c on c.relname=i.indexname
          join pg_namespace n on n.oid=c.relnamespace and n.nspname=i.schemaname
          join pg_index x on x.indexrelid=c.oid
         where i.schemaname='healthcare' and i.indexname=expected.index_name;
        if definition is null or not valid
           or regexp_replace(lower(definition),'\s+','','g') <> regexp_replace(lower(expected.expected_definition),'\s+','','g') then
            raise exception 'reconciliation index definition drifted for %', expected.index_name;
        end if;
    end loop;

    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)') and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef and p.provolatile='s' and p.proconfig=ARRAY['search_path=healthcare, pg_catalog']::text[] and p.proacl::text='{postgres=X/postgres,service_role=X/postgres}' and md5(regexp_replace(lower(p.prosrc),'\s+','','g'))='b069c1f8ece9ac07a65d1c2a2fe971fd') then
        raise exception 'list projection function fingerprint or ACL drifted';
    end if;
    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)') and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef and p.provolatile='s' and p.proconfig=ARRAY['search_path=healthcare, extensions, pg_catalog']::text[] and p.proacl::text='{postgres=X/postgres,service_role=X/postgres}' and md5(regexp_replace(lower(p.prosrc),'\s+','','g'))='2735b90ddb9cd6b206ec9a5741e60283') then
        raise exception 'match projection function fingerprint or ACL drifted';
    end if;
    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('healthcare.ai_chat_documents_tombstone_guard()') and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef and p.provolatile='v' and p.proconfig=ARRAY['search_path=healthcare, pg_catalog']::text[] and p.proacl::text='{postgres=X/postgres}' and md5(regexp_replace(lower(p.prosrc),'\s+','','g'))='a089aa59a2f15e1acea81392ea519de8') then
        raise exception 'tombstone guard function fingerprint or ACL drifted';
    end if;
    if not exists (select 1 from pg_trigger t where t.tgrelid='healthcare.ai_chat_documents'::regclass and t.tgname='ai_chat_documents_tombstone_guard' and not t.tgisinternal and t.tgenabled='O' and t.tgtype=23 and md5(regexp_replace(lower(pg_get_triggerdef(t.oid)),'\s+','','g'))='169a6d1f37436d6ccc49e3624de7455c') then
        raise exception 'tombstone trigger fingerprint drifted';
    end if;

    select pg_get_constraintdef(c.oid),c.convalidated into definition,valid
      from pg_constraint c where c.conrelid='healthcare.ai_documents'::regclass and c.conname='ai_documents_source_type';
    if definition is null or not valid
       or regexp_replace(lower(definition),'\s+','','g') <> regexp_replace(lower('CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''branch''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'),'\s+','','g') then
        raise exception 'post-apply source_type constraint is not present';
    end if;

    -- No forward consumer may have written into the newly-added columns.
    if exists (select 1 from healthcare.articles where content_language is distinct from 'vi' or audience is distinct from 'GENERAL' or topic_tags is distinct from '[]'::jsonb or key_takeaways is distinct from '[]'::jsonb or warning_signs is distinct from '[]'::jsonb or prevention_tips is distinct from '[]'::jsonb or when_to_seek_care is not null or source_references is distinct from '[]'::jsonb or clinical_metadata is distinct from '{}'::jsonb or clinical_disclaimer is not null or last_reviewed_at is not null or last_reviewed_by is not null or featured is distinct from false) then raise exception 'new article columns contain post-apply data; rollback is unsafe'; end if;
    if exists (select 1 from healthcare.specialties where clinical_overview is not null or common_conditions is distinct from '[]'::jsonb or red_flags is distinct from '[]'::jsonb or preventive_care is distinct from '[]'::jsonb or when_to_seek_care is not null or source_references is distinct from '[]'::jsonb or clinical_metadata is distinct from '{}'::jsonb or last_reviewed_at is not null or last_reviewed_by is not null) then raise exception 'new specialty columns contain post-apply data; rollback is unsafe'; end if;
    if exists (select 1 from healthcare.faqs where category is not null or audience is distinct from 'GENERAL' or topic_tags is distinct from '[]'::jsonb or related_specialty_slug is not null or source_references is distinct from '[]'::jsonb or clinical_metadata is distinct from '{}'::jsonb or clinical_disclaimer is not null or sort_order is distinct from 0 or last_reviewed_at is not null or last_reviewed_by is not null) then raise exception 'new FAQ columns contain post-apply data; rollback is unsafe'; end if;
    if exists (select 1 from healthcare.ai_chat_documents where tombstone_revision is not null) then raise exception 'tombstone_revision contains post-apply data; rollback is unsafe'; end if;

    if (select count(*) from healthcare.articles)<>500 or (select max(updated_at) from healthcare.articles)<>timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.specialties)<>30 or (select max(updated_at) from healthcare.specialties)<>timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.faqs)<>150 or (select max(updated_at) from healthcare.faqs)<>timestamptz '2026-08-23 09:00:41.102364+00'
       or (select count(*) from healthcare.ai_documents)<>10000 or (select count(*) from healthcare.ai_documents where source_type='branch')<>0 or (select max(updated_at) from healthcare.ai_documents)<>timestamptz '2026-08-24 10:48:53.018817+00'
       or (select count(*) from healthcare.ai_chat_documents)<>830 or (select count(*) from healthcare.ai_chat_documents where deleted_at is not null)<>0 or (select max(updated_at) from healthcare.ai_chat_documents)<>timestamptz '2026-08-24 10:35:10.579576+00' then
        raise exception 'data changed after the Free-plan baseline; rollback is unsafe';
    end if;

    for expected in
        select * from (values
            ('articles','9ecf3b45b518f9a505bd77b1a8e2529b',array['content_language','audience','topic_tags','key_takeaways','warning_signs','prevention_tips','when_to_seek_care','source_references','clinical_metadata','clinical_disclaimer','last_reviewed_at','last_reviewed_by','featured']::text[]),
            ('specialties','80c44b33331823193c04a67863effb59',array['clinical_overview','common_conditions','red_flags','preventive_care','when_to_seek_care','source_references','clinical_metadata','last_reviewed_at','last_reviewed_by']::text[]),
            ('faqs','0437a1dbbb5d28da2a2ab7c961d2feb2',array['category','audience','topic_tags','related_specialty_slug','source_references','clinical_metadata','clinical_disclaimer','sort_order','last_reviewed_at','last_reviewed_by']::text[]),
            ('ai_documents','0f3aea1fd31021b4ddf7666aaef27d64','{}'::text[]),
            ('ai_chat_documents','22f69fa4e6336e41d4e6fa2f66ddefa4',array['tombstone_revision']::text[])
        ) as baseline(table_name,expected_fingerprint,excluded_columns)
    loop
        execute format('select md5(coalesce(string_agg(xmin::text || '':'' || md5((to_jsonb(t) - $1::text[])::text), '''' order by id), '''')) from healthcare.%I t', expected.table_name) into fingerprint using expected.excluded_columns;
        if fingerprint <> expected.expected_fingerprint then raise exception 'baseline row fingerprint drifted for healthcare.%; rollback is unsafe',expected.table_name; end if;
    end loop;

    select p.oid,pg_get_userbyid(p.proowner),coalesce(p.proacl::text,'<NULL>'),obj_description(p.oid,'pg_proc') into helper_oid,helper_owner,helper_acl,helper_comment from pg_proc p where p.oid=to_regprocedure('public.rls_auto_enable()');
    if helper_oid is null or helper_owner<>'postgres' or helper_acl<>'{postgres=X/postgres}' or helper_comment<>'Internal DDL event trigger; execution is restricted to postgres.' or not has_function_privilege('postgres',helper_oid,'EXECUTE') or has_function_privilege('anon',helper_oid,'EXECUTE') or has_function_privilege('authenticated',helper_oid,'EXECUTE') or has_function_privilege('service_role',helper_oid,'EXECUTE') then raise exception 'platform helper post-apply ACL/comment/owner drifted'; end if;
end
$rollback_preflight$;

drop function healthcare.match_chat_documents_page(extensions.vector, real, integer, text[], text, real, uuid);
drop function healthcare.list_chat_documents_page(text, text[], timestamptz, uuid, integer, boolean);
drop trigger ai_chat_documents_tombstone_guard on healthcare.ai_chat_documents;
drop function healthcare.ai_chat_documents_tombstone_guard();

drop index healthcare.ai_chat_documents_branch_cursor_idx;
drop index healthcare.ai_chat_documents_projection_cursor_idx;
drop index healthcare.healthcare_ai_documents_branch_idx;
drop index healthcare.healthcare_faqs_rich_related_specialty_idx;
drop index healthcare.healthcare_faqs_rich_topic_tags_idx;
drop index healthcare.healthcare_specialties_rich_conditions_idx;
drop index healthcare.healthcare_articles_rich_topic_tags_idx;

alter table healthcare.ai_chat_documents drop constraint ai_chat_documents_tombstone_shape;
alter table healthcare.articles drop constraint articles_rich_content_shape;
alter table healthcare.specialties drop constraint specialties_rich_content_shape;
alter table healthcare.faqs drop constraint faqs_rich_content_shape;

alter table healthcare.ai_chat_documents drop column tombstone_revision;
alter table healthcare.articles
    drop column content_language, drop column audience, drop column topic_tags,
    drop column key_takeaways, drop column warning_signs, drop column prevention_tips,
    drop column when_to_seek_care, drop column source_references,
    drop column clinical_metadata, drop column clinical_disclaimer,
    drop column last_reviewed_at, drop column last_reviewed_by, drop column featured;
alter table healthcare.specialties
    drop column clinical_overview, drop column common_conditions, drop column red_flags,
    drop column preventive_care, drop column when_to_seek_care, drop column source_references,
    drop column clinical_metadata, drop column last_reviewed_at, drop column last_reviewed_by;
alter table healthcare.faqs
    drop column category, drop column audience, drop column topic_tags,
    drop column related_specialty_slug, drop column source_references,
    drop column clinical_metadata, drop column clinical_disclaimer, drop column sort_order,
    drop column last_reviewed_at, drop column last_reviewed_by;

alter table healthcare.ai_documents drop constraint ai_documents_source_type;
alter table healthcare.ai_documents add constraint ai_documents_source_type check (
    source_type in ('specialty', 'doctor', 'service', 'package', 'article', 'faq')
) not valid;
alter table healthcare.ai_documents validate constraint ai_documents_source_type;

-- Preserve the already-hardened event-trigger helper; rollback must not reopen
-- public execution merely because it is compensating the catalog delta.
do $restore_helper$
begin
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
    execute 'grant execute on function public.rls_auto_enable() to postgres';
    execute 'comment on function public.rls_auto_enable() is ' || quote_literal('Internal DDL event trigger; execution is restricted to postgres.');
end
$restore_helper$;

do $rollback_postconditions$
declare
    actual text;
    valid boolean;
    fingerprint text;
    expected record;
begin
    if exists (select 1 from information_schema.columns where table_schema='healthcare' and ((table_name='articles' and column_name in ('content_language','audience','topic_tags','key_takeaways','warning_signs','prevention_tips','when_to_seek_care','source_references','clinical_metadata','clinical_disclaimer','last_reviewed_at','last_reviewed_by','featured')) or (table_name='specialties' and column_name in ('clinical_overview','common_conditions','red_flags','preventive_care','when_to_seek_care','source_references','clinical_metadata','last_reviewed_at','last_reviewed_by')) or (table_name='faqs' and column_name in ('category','audience','topic_tags','related_specialty_slug','source_references','clinical_metadata','clinical_disclaimer','sort_order','last_reviewed_at','last_reviewed_by')) or (table_name='ai_chat_documents' and column_name='tombstone_revision'))) then raise exception 'rollback left reconciliation columns'; end if;
    if to_regprocedure('healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)') is not null or to_regprocedure('healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)') is not null or to_regprocedure('healthcare.ai_chat_documents_tombstone_guard()') is not null or exists (select 1 from pg_trigger where tgrelid='healthcare.ai_chat_documents'::regclass and tgname='ai_chat_documents_tombstone_guard' and not tgisinternal) then raise exception 'rollback left reconciliation routines'; end if;
    if exists (select 1 from pg_constraint where conname in ('articles_rich_content_shape','specialties_rich_content_shape','faqs_rich_content_shape','ai_chat_documents_tombstone_shape')) or exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='healthcare' and c.relname in ('healthcare_articles_rich_topic_tags_idx','healthcare_specialties_rich_conditions_idx','healthcare_faqs_rich_topic_tags_idx','healthcare_faqs_rich_related_specialty_idx','healthcare_ai_documents_branch_idx','ai_chat_documents_projection_cursor_idx','ai_chat_documents_branch_cursor_idx')) then raise exception 'rollback left reconciliation constraints or indexes'; end if;
    select pg_get_constraintdef(c.oid),c.convalidated into actual,valid from pg_constraint c where c.conrelid='healthcare.ai_documents'::regclass and c.conname='ai_documents_source_type';
    if actual is null or not valid or regexp_replace(lower(actual),'\s+','','g') <> regexp_replace(lower('CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'),'\s+','','g') then raise exception 'baseline source_type constraint was not restored'; end if;
    if (select count(*) from healthcare.articles)<>500 or (select count(*) from healthcare.specialties)<>30 or (select count(*) from healthcare.faqs)<>150 or (select count(*) from healthcare.ai_documents)<>10000 or (select count(*) from healthcare.ai_chat_documents)<>830 or (select count(*) from healthcare.ai_chat_documents where deleted_at is not null)<>0 then raise exception 'rollback changed baseline row counts'; end if;
    for expected in select * from (values ('articles','9ecf3b45b518f9a505bd77b1a8e2529b','{}'::text[]),('specialties','80c44b33331823193c04a67863effb59','{}'::text[]),('faqs','0437a1dbbb5d28da2a2ab7c961d2feb2','{}'::text[]),('ai_documents','0f3aea1fd31021b4ddf7666aaef27d64','{}'::text[]),('ai_chat_documents','22f69fa4e6336e41d4e6fa2f66ddefa4','{}'::text[])) as baseline(table_name,expected_fingerprint,excluded_columns) loop
        execute format('select md5(coalesce(string_agg(xmin::text || '':'' || md5((to_jsonb(t) - $1::text[])::text), '''' order by id), '''')) from healthcare.%I t',expected.table_name) into fingerprint using expected.excluded_columns;
        if fingerprint<>expected.expected_fingerprint then raise exception 'post-rollback row fingerprint mismatch for healthcare.%',expected.table_name; end if;
    end loop;
    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.rls_auto_enable()') and pg_get_userbyid(p.proowner)='postgres' and coalesce(p.proacl::text,'<NULL>')='{postgres=X/postgres}' and obj_description(p.oid,'pg_proc')='Internal DDL event trigger; execution is restricted to postgres.' and has_function_privilege('postgres',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE')) then raise exception 'platform helper ACL/comment/owner was not preserved'; end if;
end
$rollback_postconditions$;

commit;
