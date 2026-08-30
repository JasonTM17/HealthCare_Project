-- Hosted-safe reconciliation for the clinical catalog and chatbot projection.
--
-- The hosted project already contains the semantic equivalent of the first
-- four local migrations under different version identifiers. This migration
-- contains only the additive objects absent from that catalog. It is also safe
-- after a clean local reset where the earlier local follow-up migrations have
-- already installed the same end state.
--
-- Spring PostgreSQL remains the identity, clinical, and conversation-history
-- authority. No patient, user, conversation, or message identity is added.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
declare
    baseline record;
    match_oid oid;
    touch_oid oid;
    guard_oid oid;
    list_page_oid oid;
    match_page_oid oid;
    page_definition text;
    trigger_function text;
    policy_roles name[];
    policy_command text;
    policy_qual text;
    policy_check text;
    actual_type text;
    actual_nullable text;
    source_constraint_definition text;
    source_constraint_validated boolean;
begin
    if to_regclass('healthcare.articles') is null
       or to_regclass('healthcare.specialties') is null
       or to_regclass('healthcare.faqs') is null
       or to_regclass('healthcare.ai_documents') is null
       or to_regclass('healthcare.ai_chat_documents') is null then
        raise exception 'healthcare reconciliation baseline is incomplete';
    end if;

    if exists (
        select 1
          from healthcare.ai_documents
         where source_type not in (
             'specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq'
         )
    ) then
        raise exception 'unexpected ai_documents source type blocks reconciliation';
    end if;

    if exists (
        select 1
          from healthcare.ai_chat_documents
         where content_revision <= 0 or eligibility_revision <= 0
    ) then
        raise exception 'non-positive chat projection revision blocks reconciliation';
    end if;

    -- Refuse to run against an unknown baseline.  These are the columns and
    -- relations required by the additive statements below; a missing item is
    -- a target-selection/schema-drift error, not something this migration may
    -- guess how to repair.
    for baseline in
        select * from (values
            ('articles', 'id'), ('articles', 'title'), ('articles', 'slug'),
            ('articles', 'published_at'), ('articles', 'active'),
            ('specialties', 'id'), ('specialties', 'name'), ('specialties', 'slug'),
            ('specialties', 'active'),
            ('faqs', 'id'), ('faqs', 'question'), ('faqs', 'answer'), ('faqs', 'active'),
            ('ai_documents', 'id'), ('ai_documents', 'source_type'),
            ('ai_documents', 'source_id'), ('ai_documents', 'title'),
            ('ai_documents', 'content'), ('ai_documents', 'metadata'),
            ('ai_documents', 'embedding_model'), ('ai_documents', 'embedding_provenance'),
            ('ai_documents', 'content_hash'), ('ai_documents', 'sync_revision'),
            ('ai_documents', 'embedding'), ('ai_documents', 'deleted_at'),
            ('ai_documents', 'active'), ('ai_documents', 'published'),
            ('ai_documents', 'published_at'), ('ai_documents', 'created_at'),
            ('ai_documents', 'updated_at'), ('ai_documents', 'search_vector'),
            ('ai_documents', 'embedding_dimension'),
            ('ai_chat_documents', 'id'), ('ai_chat_documents', 'projection_kind'),
            ('ai_chat_documents', 'source_type'), ('ai_chat_documents', 'source_id'),
            ('ai_chat_documents', 'content_revision'),
            ('ai_chat_documents', 'eligibility_revision'),
            ('ai_chat_documents', 'content_hash'), ('ai_chat_documents', 'title'),
            ('ai_chat_documents', 'content'), ('ai_chat_documents', 'metadata'),
            ('ai_chat_documents', 'embedding'), ('ai_chat_documents', 'embedding_model'),
            ('ai_chat_documents', 'embedding_provenance'),
            ('ai_chat_documents', 'approval_round'), ('ai_chat_documents', 'approval_expires_at'),
            ('ai_chat_documents', 'active'),
            ('ai_chat_documents', 'published'), ('ai_chat_documents', 'deleted_at'),
            ('ai_chat_documents', 'created_at'), ('ai_chat_documents', 'updated_at'),
            ('ai_chat_documents', 'search_vector')
        ) as required(table_name, column_name)
    loop
        if not exists (
            select 1 from information_schema.columns
             where table_schema = 'healthcare'
               and table_name = baseline.table_name
               and column_name = baseline.column_name
        ) then
            raise exception 'baseline column healthcare.%.% is missing',
                baseline.table_name, baseline.column_name;
        end if;
    end loop;

    for baseline in
        select * from (values
            ('articles', 'id', 'uuid', 'NO'), ('articles', 'title', 'text', 'NO'),
            ('articles', 'slug', 'text', 'NO'), ('articles', 'published_at', 'timestamp with time zone', 'YES'),
            ('articles', 'active', 'boolean', 'NO'),
            ('specialties', 'id', 'uuid', 'NO'), ('specialties', 'name', 'text', 'NO'),
            ('specialties', 'slug', 'text', 'NO'), ('specialties', 'active', 'boolean', 'NO'),
            ('faqs', 'id', 'uuid', 'NO'), ('faqs', 'question', 'text', 'NO'),
            ('faqs', 'answer', 'text', 'NO'), ('faqs', 'active', 'boolean', 'NO'),
            ('ai_documents', 'id', 'uuid', 'NO'), ('ai_documents', 'source_type', 'text', 'NO'),
            ('ai_documents', 'source_id', 'text', 'NO'), ('ai_documents', 'title', 'text', 'NO'),
            ('ai_documents', 'content', 'text', 'NO'), ('ai_documents', 'metadata', 'jsonb', 'NO'),
            ('ai_documents', 'embedding_model', 'text', 'NO'),
            ('ai_documents', 'embedding_provenance', 'text', 'NO'),
            ('ai_documents', 'content_hash', 'text', 'NO'), ('ai_documents', 'sync_revision', 'bigint', 'NO'),
            ('ai_documents', 'embedding', 'USER-DEFINED', 'YES'),
            ('ai_documents', 'deleted_at', 'timestamp with time zone', 'YES'),
            ('ai_documents', 'active', 'boolean', 'NO'), ('ai_documents', 'published', 'boolean', 'NO'),
            ('ai_documents', 'published_at', 'timestamp with time zone', 'YES'),
            ('ai_documents', 'created_at', 'timestamp with time zone', 'NO'),
            ('ai_documents', 'updated_at', 'timestamp with time zone', 'NO'),
            ('ai_documents', 'search_vector', 'tsvector', 'YES'),
            ('ai_documents', 'embedding_dimension', 'smallint', 'NO'),
            ('ai_chat_documents', 'id', 'uuid', 'NO'), ('ai_chat_documents', 'projection_kind', 'text', 'NO'),
            ('ai_chat_documents', 'source_type', 'text', 'NO'), ('ai_chat_documents', 'source_id', 'text', 'NO'),
            ('ai_chat_documents', 'content_revision', 'bigint', 'NO'),
            ('ai_chat_documents', 'eligibility_revision', 'bigint', 'NO'),
            ('ai_chat_documents', 'content_hash', 'text', 'NO'), ('ai_chat_documents', 'title', 'text', 'NO'),
            ('ai_chat_documents', 'content', 'text', 'NO'), ('ai_chat_documents', 'metadata', 'jsonb', 'NO'),
            ('ai_chat_documents', 'embedding', 'USER-DEFINED', 'YES'),
            ('ai_chat_documents', 'embedding_model', 'text', 'NO'),
            ('ai_chat_documents', 'embedding_provenance', 'text', 'NO'),
            ('ai_chat_documents', 'approval_round', 'bigint', 'YES'),
            ('ai_chat_documents', 'approval_expires_at', 'timestamp with time zone', 'YES'),
            ('ai_chat_documents', 'active', 'boolean', 'NO'), ('ai_chat_documents', 'published', 'boolean', 'NO'),
            ('ai_chat_documents', 'deleted_at', 'timestamp with time zone', 'YES'),
            ('ai_chat_documents', 'created_at', 'timestamp with time zone', 'NO'),
            ('ai_chat_documents', 'updated_at', 'timestamp with time zone', 'NO'),
            ('ai_chat_documents', 'search_vector', 'tsvector', 'YES')
        ) as required(table_name, column_name, data_type, is_nullable)
    loop
        select c.data_type, c.is_nullable
          into actual_type, actual_nullable
          from information_schema.columns c
         where c.table_schema = 'healthcare'
           and c.table_name = baseline.table_name
           and c.column_name = baseline.column_name;
        if actual_type <> baseline.data_type or actual_nullable <> baseline.is_nullable then
            raise exception 'incompatible baseline healthcare.%.% definition',
                baseline.table_name, baseline.column_name;
        end if;
    end loop;

    if exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'healthcare'
           and c.relname in (
               'articles', 'specialties', 'faqs', 'branches', 'doctors',
               'services', 'packages', 'doctor_specialties', 'doctor_branches',
               'ai_documents',
               'ai_chat_documents', 'customers', 'patient_profiles',
               'synthetic_seed_runs', 'synthetic_seed_chunks'
           )
           and not c.relrowsecurity
    ) then
        raise exception 'baseline RLS state is weaker than the reviewed target';
    end if;

    for baseline in
        select * from (values
            ('specialties', 'specialties_public_read', 'active'),
            ('branches', 'branches_public_read', 'active'),
            ('doctors', 'doctors_public_read', 'active'),
            ('services', 'services_public_read', 'active'),
            ('packages', 'packages_public_read', 'active'),
            ('articles', 'articles_public_read', '(active AND (published_at IS NOT NULL))'),
            ('faqs', 'faqs_public_read', 'active'),
            ('doctor_specialties', 'doctor_specialties_public_read',
                '((EXISTS (SELECT 1 FROM healthcare.doctors d WHERE ((d.id = doctor_specialties.doctor_id) AND d.active))) AND (EXISTS (SELECT 1 FROM healthcare.specialties s WHERE ((s.id = doctor_specialties.specialty_id) AND s.active))))'),
            ('doctor_branches', 'doctor_branches_public_read',
                '((EXISTS (SELECT 1 FROM healthcare.doctors d WHERE ((d.id = doctor_branches.doctor_id) AND d.active))) AND (EXISTS (SELECT 1 FROM healthcare.branches b WHERE ((b.id = doctor_branches.branch_id) AND b.active))))'),
            ('ai_documents', 'ai_documents_public_read', '(active AND published AND (deleted_at IS NULL))')
        ) as required(table_name, policy_name, expected_qual)
    loop
        select p.roles, p.cmd, p.qual, p.with_check
          into policy_roles, policy_command, policy_qual, policy_check
          from pg_policies p
         where p.schemaname = 'healthcare'
           and p.tablename = baseline.table_name
           and p.policyname = baseline.policy_name;
        if not found then
            raise exception 'baseline policy healthcare.% is missing', baseline.policy_name;
        end if;
        if policy_roles <> ARRAY['anon'::name, 'authenticated'::name]
           or policy_command <> 'SELECT'
           or policy_check is not null
           or regexp_replace(lower(coalesce(policy_qual, '')), '\s+', '', 'g')
              <> regexp_replace(lower(baseline.expected_qual), '\s+', '', 'g') then
            raise exception 'baseline policy healthcare.% is not the reviewed exact read policy',
                baseline.policy_name;
        end if;
    end loop;

    if exists (
        select 1 from pg_policies
         where schemaname = 'healthcare'
           and tablename in (
               'customers', 'patient_profiles', 'ai_chat_documents',
               'synthetic_seed_runs', 'synthetic_seed_chunks'
           )
    ) then
        raise exception 'server-only healthcare tables have an unexpected browser policy';
    end if;

    if exists (
        select 1
          from pg_policies p
         where p.schemaname = 'healthcare'
           and not exists (
               select 1
                 from (values
                     ('specialties', 'specialties_public_read'),
                     ('branches', 'branches_public_read'),
                     ('doctors', 'doctors_public_read'),
                     ('services', 'services_public_read'),
                     ('packages', 'packages_public_read'),
                     ('articles', 'articles_public_read'),
                     ('faqs', 'faqs_public_read'),
                     ('doctor_specialties', 'doctor_specialties_public_read'),
                     ('doctor_branches', 'doctor_branches_public_read'),
                     ('ai_documents', 'ai_documents_public_read')
                 ) as allowed(table_name, policy_name)
                where allowed.table_name = p.tablename
                  and allowed.policy_name = p.policyname
           )
    ) then
        raise exception 'healthcare contains a policy outside the reviewed exact allowlist';
    end if;

    if has_schema_privilege('anon', 'healthcare', 'CREATE')
       or has_schema_privilege('authenticated', 'healthcare', 'CREATE')
       or has_schema_privilege('service_role', 'healthcare', 'CREATE')
       or not has_schema_privilege('anon', 'healthcare', 'USAGE')
       or not has_schema_privilege('authenticated', 'healthcare', 'USAGE')
       or not has_schema_privilege('service_role', 'healthcare', 'USAGE') then
        raise exception 'healthcare schema role privileges are not the reviewed shape';
    end if;

    if exists (
        select 1
          from pg_namespace n
          cross join lateral aclexplode(
              coalesce(n.nspacl, acldefault('n', n.nspowner))
          ) acl
         where n.nspname = 'healthcare'
           and acl.grantee <> n.nspowner
           and acl.grantee not in (
               coalesce((select oid from pg_roles where rolname = 'anon'), 0),
               coalesce((select oid from pg_roles where rolname = 'authenticated'), 0),
               coalesce((select oid from pg_roles where rolname = 'service_role'), 0)
           )
    ) then
        raise exception 'healthcare schema has a grant to an unexpected role';
    end if;

    for baseline in
        select * from (values
            ('specialties'), ('branches'), ('doctors'), ('services'),
            ('packages'), ('articles'), ('faqs'), ('doctor_specialties'),
            ('doctor_branches'), ('ai_documents')
        ) as allowed(table_name)
    loop
        if not has_table_privilege(
                'anon', format('healthcare.%I', baseline.table_name), 'SELECT'
           )
           or not has_table_privilege(
                'authenticated', format('healthcare.%I', baseline.table_name), 'SELECT'
           ) then
            raise exception 'browser SELECT grant on healthcare.% is missing',
                baseline.table_name;
        end if;
    end loop;

    if exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          cross join (values ('anon'), ('authenticated')) as browser(role_name)
          cross join (values
              ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
              ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
          ) as privilege(privilege_name)
         where n.nspname = 'healthcare'
           and c.relkind in ('r', 'p')
           and has_table_privilege(
               browser.role_name, c.oid, privilege.privilege_name
           )
           and (
               privilege.privilege_name <> 'SELECT'
               or c.relname not in (
                   'specialties', 'branches', 'doctors', 'services',
                   'packages', 'articles', 'faqs', 'doctor_specialties',
                   'doctor_branches', 'ai_documents'
               )
           )
    ) then
        raise exception 'browser table privileges exceed the reviewed SELECT-only allowlist';
    end if;

    if exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          cross join lateral aclexplode(
              coalesce(c.relacl, acldefault('r', c.relowner))
          ) acl
         where n.nspname = 'healthcare'
           and c.relkind in ('r', 'p')
           and acl.grantee <> c.relowner
           and acl.grantee not in (
               coalesce((select oid from pg_roles where rolname = 'anon'), 0),
               coalesce((select oid from pg_roles where rolname = 'authenticated'), 0),
               coalesce((select oid from pg_roles where rolname = 'service_role'), 0)
           )
    ) then
        raise exception 'healthcare table ACL contains an unexpected grantee';
    end if;

    if has_table_privilege('anon', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('anon', 'healthcare.customers', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.patient_profiles', 'SELECT') then
        raise exception 'server-only baseline table privileges are broader than expected';
    end if;

    for baseline in
        select * from (values
            ('customers'), ('patient_profiles'), ('synthetic_seed_runs'),
            ('synthetic_seed_chunks'), ('ai_chat_documents')
        ) as server_only(table_name)
    loop
        if not has_table_privilege(
                'service_role', format('healthcare.%I', baseline.table_name), 'SELECT'
           )
           or not has_table_privilege(
                'service_role', format('healthcare.%I', baseline.table_name), 'INSERT'
           )
           or not has_table_privilege(
                'service_role', format('healthcare.%I', baseline.table_name), 'UPDATE'
           )
           or not has_table_privilege(
                'service_role', format('healthcare.%I', baseline.table_name), 'DELETE'
           ) then
            raise exception 'service_role write authority on healthcare.% is missing',
                baseline.table_name;
        end if;
    end loop;

    match_oid := to_regprocedure(
        'healthcare.match_chat_documents(extensions.vector,real,integer,text[],text)'
    );
    if match_oid is null
       or has_function_privilege('anon', match_oid, 'EXECUTE')
       or has_function_privilege('authenticated', match_oid, 'EXECUTE')
       or not has_function_privilege('service_role', match_oid, 'EXECUTE') then
        raise exception 'baseline chat retrieval authority/ACL is not the reviewed shape';
    end if;
    if not exists (
        select 1
          from pg_proc p
         where p.oid = match_oid
           and not p.prosecdef
           and p.provolatile = 's'
           and p.proconfig = ARRAY['search_path=healthcare, extensions, pg_catalog']::text[]
           and md5(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'))
               = 'e5032819be774757b87dcfa208fe45d9'
    ) then
        raise exception 'baseline chat retrieval body/security/search_path fingerprint drifted';
    end if;
    if exists (
        select 1
          from pg_proc p
          cross join lateral aclexplode(
              coalesce(p.proacl, acldefault('f', p.proowner))
          ) acl
         where p.oid = match_oid
           and acl.grantee <> p.proowner
           and acl.grantee <> coalesce(
               (select oid from pg_roles where rolname = 'service_role'), 0
           )
    ) then
        raise exception 'baseline chat retrieval ACL contains an unexpected grantee';
    end if;

    touch_oid := to_regprocedure('healthcare.touch_updated_at()');
    if touch_oid is null or not exists (
        select 1
          from pg_proc p
         where p.oid = touch_oid
           and not p.prosecdef
           and p.provolatile = 'v'
           and p.proconfig = ARRAY['search_path=healthcare']::text[]
           and md5(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'))
               = 'e6a34ef71a2b36972c01c5b4edb7ce82'
    ) then
        raise exception 'baseline updated_at function fingerprint drifted';
    end if;

    if to_regtype('extensions.vector') is null then
        raise exception 'required extensions.vector type is missing';
    end if;

    -- Retrieval is dimension-bound: every producer and consumer in this
    -- projection uses extensions.vector(384).  Checking only that the type
    -- exists would allow a drifted vector(1536) column to pass preflight and
    -- fail later when the vector(384) RPC receives it.
    if not exists (
        select 1
          from pg_attribute a
          join pg_type t on t.oid = a.atttypid
          join pg_namespace n on n.oid = t.typnamespace
         where a.attrelid = 'healthcare.ai_documents'::regclass
           and a.attname = 'embedding'
           and not a.attisdropped
           and n.nspname = 'extensions'
           and t.typname = 'vector'
           and a.atttypmod = 384
    ) or not exists (
        select 1
          from pg_attribute a
          join pg_type t on t.oid = a.atttypid
          join pg_namespace n on n.oid = t.typnamespace
         where a.attrelid = 'healthcare.ai_chat_documents'::regclass
           and a.attname = 'embedding'
           and not a.attisdropped
           and n.nspname = 'extensions'
           and t.typname = 'vector'
           and a.atttypmod = 384
    ) then
        raise exception 'embedding vector contract is not extensions.vector(384)';
    end if;

    if exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'healthcare.ai_documents'::regclass
           and c.contype = 'c'
           and c.conname <> 'ai_documents_source_type'
           and pg_get_constraintdef(c.oid) ilike '%source_type%'
    ) then
        raise exception 'unexpected competing ai_documents source_type constraint';
    end if;

    -- This named check is intentionally replaced below to add the branch
    -- source.  If it already exists, only the exact reviewed pre-branch or
    -- post-branch definition is accepted; a similarly named drifted check is
    -- never silently discarded.
    select pg_get_constraintdef(c.oid), c.convalidated
      into source_constraint_definition, source_constraint_validated
      from pg_constraint c
     where c.conrelid = 'healthcare.ai_documents'::regclass
       and c.conname = 'ai_documents_source_type';
    if source_constraint_definition is not null
       and (
           not source_constraint_validated
           or (
               regexp_replace(lower(source_constraint_definition), '\s+', '', 'g')
                   <> regexp_replace(lower('CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'), '\s+', '', 'g')
               and regexp_replace(lower(source_constraint_definition), '\s+', '', 'g')
                   <> regexp_replace(lower('CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''branch''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'), '\s+', '', 'g')
           )
       ) then
        raise exception 'existing ai_documents_source_type constraint is incompatible';
    end if;

    for baseline in
        select * from (values
            ('ai_chat_documents', 'ai_chat_documents_touch_updated_at',
                '26f26648cee8bd6c1bdf265c09ff88fe'),
            ('synthetic_seed_runs', 'synthetic_seed_runs_touch_updated_at',
                '9e4b37d50d43bfadcf78608dd4700653'),
            ('synthetic_seed_chunks', 'synthetic_seed_chunks_touch_updated_at',
                'e269bdc9c87e8acffb1f02fa1d0b1998')
        ) as required(table_name, trigger_name, expected_hash)
    loop
        if not exists (
            select 1
              from pg_trigger t
             where t.tgrelid = format('healthcare.%s', baseline.table_name)::regclass
               and t.tgname = baseline.trigger_name
               and not t.tgisinternal
               and t.tgtype = 19
               and t.tgenabled = 'O'
               and t.tgfoid = touch_oid
               and md5(regexp_replace(lower(pg_get_triggerdef(t.oid)), '\s+', '', 'g'))
                   = baseline.expected_hash
        ) then
            raise exception 'baseline trigger healthcare.% exact fingerprint drifted',
                baseline.trigger_name;
        end if;
    end loop;

    guard_oid := to_regprocedure('healthcare.ai_chat_documents_tombstone_guard()');
    if guard_oid is not null and not exists (
        select 1
          from pg_proc p
         where p.oid = guard_oid
           and not p.prosecdef
           and p.provolatile = 'v'
           and p.proconfig = ARRAY['search_path=healthcare, pg_catalog']::text[]
           and md5(regexp_replace(lower(p.prosrc), '\s+', '', 'g'))
               = 'a089aa59a2f15e1acea81392ea519de8'
    ) then
        raise exception 'existing tombstone guard function is not the reviewed implementation';
    end if;

    select p.oid::regprocedure::text
      into trigger_function
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'healthcare.ai_chat_documents'::regclass
       and t.tgname = 'ai_chat_documents_tombstone_guard'
       and not t.tgisinternal;
    if trigger_function is not null
       and trigger_function <> 'healthcare.ai_chat_documents_tombstone_guard()' then
        raise exception 'existing tombstone trigger points to an unexpected function';
    end if;
    if trigger_function is not null and not exists (
        select 1
          from pg_trigger t
         where t.tgrelid = 'healthcare.ai_chat_documents'::regclass
           and t.tgname = 'ai_chat_documents_tombstone_guard'
           and not t.tgisinternal
           and t.tgtype = 23
           and t.tgenabled = 'O'
           and t.tgfoid = guard_oid
           and md5(regexp_replace(lower(pg_get_triggerdef(t.oid)), '\s+', '', 'g'))
               = '169a6d1f37436d6ccc49e3624de7455c'
    ) then
        raise exception 'existing tombstone trigger is not the reviewed exact definition';
    end if;

    list_page_oid := to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    );
    if list_page_oid is not null then
        page_definition := pg_get_functiondef(list_page_oid);
        if exists (
            select 1 from pg_proc p
             where p.oid = list_page_oid
               and (p.prosecdef or p.provolatile <> 's'
                    or p.proconfig <> ARRAY['search_path=healthcare, pg_catalog']::text[])
        )
           or page_definition !~* 'cursor_updated_at'
           or page_definition !~* 'd\.updated_at < cursor_updated_at'
           or page_definition !~* 'd\.id < cursor_id'
           or page_definition !~* 'order by d\.updated_at desc, d\.id desc'
           or page_definition !~* 'limit least'
           or not exists (
               select 1 from pg_proc p
                where p.oid = list_page_oid
                  and md5(regexp_replace(lower(p.prosrc), '\s+', '', 'g'))
                      = 'b069c1f8ece9ac07a65d1c2a2fe971fd'
           ) then
            raise exception 'existing list projection page function is not the reviewed implementation';
        end if;
        if exists (
            select 1
              from pg_proc p
              cross join lateral aclexplode(
                  coalesce(p.proacl, acldefault('f', p.proowner))
              ) acl
             where p.oid = list_page_oid
               and acl.grantee <> p.proowner
               and acl.grantee <> coalesce(
                   (select oid from pg_roles where rolname = 'service_role'), 0
               )
        ) then
            raise exception 'existing list projection page ACL contains an unexpected grantee';
        end if;
    end if;

    match_page_oid := to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    );
    if match_page_oid is not null then
        page_definition := pg_get_functiondef(match_page_oid);
        if exists (
            select 1 from pg_proc p
             where p.oid = match_page_oid
               and (p.prosecdef or p.provolatile <> 's'
                    or p.proconfig <> ARRAY['search_path=healthcare, extensions, pg_catalog']::text[])
        )
           or page_definition !~* 'after_score'
           or page_definition !~* 'd\.projection_kind = ''OPERATIONAL'''
           or page_definition !~* 'd\.approval_expires_at > current_timestamp'
           or page_definition !~* 'r\.score < after_score'
           or page_definition !~* 'order by r\.score desc, r\.id'
           or page_definition !~* 'current_timestamp'
           or page_definition !~* 'limit least'
           or not exists (
               select 1 from pg_proc p
                where p.oid = match_page_oid
                  and md5(regexp_replace(lower(p.prosrc), '\s+', '', 'g'))
                      = '2735b90ddb9cd6b206ec9a5741e60283'
           ) then
            raise exception 'existing match projection page function is not the reviewed implementation';
        end if;
        if exists (
            select 1
              from pg_proc p
              cross join lateral aclexplode(
                  coalesce(p.proacl, acldefault('f', p.proowner))
              ) acl
             where p.oid = match_page_oid
               and acl.grantee <> p.proowner
               and acl.grantee <> coalesce(
                   (select oid from pg_roles where rolname = 'service_role'), 0
               )
        ) then
            raise exception 'existing match projection page ACL contains an unexpected grantee';
        end if;
    end if;
end
$preflight$;

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

do $column_compatibility$
declare
    expected record;
    actual_type text;
    actual_nullable text;
begin
    for expected in
        select * from (values
            ('articles', 'content_language', 'text', 'NO'),
            ('articles', 'audience', 'text', 'NO'),
            ('articles', 'topic_tags', 'jsonb', 'NO'),
            ('articles', 'key_takeaways', 'jsonb', 'NO'),
            ('articles', 'warning_signs', 'jsonb', 'NO'),
            ('articles', 'prevention_tips', 'jsonb', 'NO'),
            ('articles', 'when_to_seek_care', 'text', 'YES'),
            ('articles', 'source_references', 'jsonb', 'NO'),
            ('articles', 'clinical_metadata', 'jsonb', 'NO'),
            ('articles', 'clinical_disclaimer', 'text', 'YES'),
            ('articles', 'last_reviewed_at', 'timestamp with time zone', 'YES'),
            ('articles', 'last_reviewed_by', 'text', 'YES'),
            ('articles', 'featured', 'boolean', 'NO'),
            ('specialties', 'clinical_overview', 'text', 'YES'),
            ('specialties', 'common_conditions', 'jsonb', 'NO'),
            ('specialties', 'red_flags', 'jsonb', 'NO'),
            ('specialties', 'preventive_care', 'jsonb', 'NO'),
            ('specialties', 'when_to_seek_care', 'text', 'YES'),
            ('specialties', 'source_references', 'jsonb', 'NO'),
            ('specialties', 'clinical_metadata', 'jsonb', 'NO'),
            ('specialties', 'last_reviewed_at', 'timestamp with time zone', 'YES'),
            ('specialties', 'last_reviewed_by', 'text', 'YES'),
            ('faqs', 'category', 'text', 'YES'),
            ('faqs', 'audience', 'text', 'NO'),
            ('faqs', 'topic_tags', 'jsonb', 'NO'),
            ('faqs', 'related_specialty_slug', 'text', 'YES'),
            ('faqs', 'source_references', 'jsonb', 'NO'),
            ('faqs', 'clinical_metadata', 'jsonb', 'NO'),
            ('faqs', 'clinical_disclaimer', 'text', 'YES'),
            ('faqs', 'sort_order', 'integer', 'NO'),
            ('faqs', 'last_reviewed_at', 'timestamp with time zone', 'YES'),
            ('faqs', 'last_reviewed_by', 'text', 'YES')
        ) as required(table_name, column_name, data_type, is_nullable)
    loop
        select c.data_type, c.is_nullable
          into actual_type, actual_nullable
          from information_schema.columns c
         where c.table_schema = 'healthcare'
           and c.table_name = expected.table_name
           and c.column_name = expected.column_name;
        if actual_type is null
           or actual_type <> expected.data_type
           or (expected.is_nullable = 'NO' and actual_nullable <> 'NO') then
            raise exception 'incompatible existing healthcare.%.% definition',
                expected.table_name, expected.column_name;
        end if;
    end loop;
end
$column_compatibility$;

do $existing_constraint_compatibility$
declare
    expected record;
    definition text;
    is_validated boolean;
begin
    for expected in
        select * from (values
            ('articles', 'articles_rich_content_shape',
                'CHECK (((content_language ~ ''^[a-z]{2}(-[A-Z]{2})?$''::text) AND (audience = ANY (ARRAY[''GENERAL''::text, ''PATIENT''::text, ''CAREGIVER''::text, ''PROFESSIONAL''::text])) AND (jsonb_typeof(topic_tags) = ''array''::text) AND (jsonb_typeof(key_takeaways) = ''array''::text) AND (jsonb_typeof(warning_signs) = ''array''::text) AND (jsonb_typeof(prevention_tips) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536)))'),
            ('specialties', 'specialties_rich_content_shape',
                'CHECK (((jsonb_typeof(common_conditions) = ''array''::text) AND (jsonb_typeof(red_flags) = ''array''::text) AND (jsonb_typeof(preventive_care) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536)))'),
            ('faqs', 'faqs_rich_content_shape',
                'CHECK (((audience = ANY (ARRAY[''GENERAL''::text, ''PATIENT''::text, ''CAREGIVER''::text, ''PROFESSIONAL''::text])) AND (jsonb_typeof(topic_tags) = ''array''::text) AND (jsonb_typeof(source_references) = ''array''::text) AND (jsonb_typeof(clinical_metadata) = ''object''::text) AND (pg_column_size(clinical_metadata) <= 65536) AND (sort_order >= 0)))')
        ) as required(table_name, constraint_name, expected_definition)
    loop
        select pg_get_constraintdef(c.oid), c.convalidated
          into definition, is_validated
          from pg_constraint c
         where c.conrelid = format('healthcare.%s', expected.table_name)::regclass
           and c.conname = expected.constraint_name;
        if definition is not null
           and (
               not is_validated
               or regexp_replace(lower(definition), '\s+', '', 'g')
                  <> regexp_replace(lower(expected.expected_definition), '\s+', '', 'g')
           ) then
            raise exception 'existing healthcare.%.% constraint is incompatible',
                expected.table_name, expected.constraint_name;
        end if;
    end loop;
end
$existing_constraint_compatibility$;

do $projection_constraint_compatibility$
declare
    expected record;
    definition text;
    is_validated boolean;
begin
    -- The pagination/RAG routines below rely on these invariants.  Validate
    -- every pre-existing named check before adding the tombstone contract so
    -- a permissive or renamed constraint cannot silently broaden retrieval.
    for expected in
        select * from (values
            ('ai_chat_documents', 'ai_chat_documents_approval_metadata',
                'CHECK (((projection_kind = ''OPERATIONAL''::text) OR (deleted_at IS NOT NULL) OR ((approval_round IS NOT NULL) AND (approval_round > 0) AND (approval_expires_at IS NOT NULL))))'),
            ('ai_chat_documents', 'ai_chat_documents_content_size',
                'CHECK (((length(content) >= 1) AND (length(content) <= 20000)))'),
            ('ai_chat_documents', 'ai_chat_documents_embedding_model',
                'CHECK (((length(btrim(embedding_model)) >= 1) AND (length(btrim(embedding_model)) <= 200)))'),
            ('ai_chat_documents', 'ai_chat_documents_embedding_shape',
                'CHECK (((embedding IS NULL) OR (vector_dims(embedding) = 384)))'),
            ('ai_chat_documents', 'ai_chat_documents_hash',
                'CHECK ((content_hash ~ ''^[0-9a-f]{64}$''::text))'),
            ('ai_chat_documents', 'ai_chat_documents_metadata_object',
                'CHECK ((jsonb_typeof(metadata) = ''object''::text))'),
            ('ai_chat_documents', 'ai_chat_documents_projection_kind',
                'CHECK ((projection_kind = ANY (ARRAY[''OPERATIONAL''::text, ''CLINICAL''::text])))'),
            ('ai_chat_documents', 'ai_chat_documents_provenance',
                'CHECK ((embedding_provenance = ANY (ARRAY[''local_provider''::text, ''remote_provider''::text, ''local_fallback''::text])))'),
            ('ai_chat_documents', 'ai_chat_documents_revision',
                'CHECK (((content_revision > 0) AND (eligibility_revision > 0)))'),
            ('ai_chat_documents', 'ai_chat_documents_source_id',
                'CHECK (((source_id ~ ''^[A-Za-z0-9._:-]+$''::text) AND ((length(source_id) >= 1) AND (length(source_id) <= 200))))'),
            ('ai_chat_documents', 'ai_chat_documents_source_type',
                'CHECK ((source_type = ANY (ARRAY[''specialty''::text, ''doctor''::text, ''branch''::text, ''service''::text, ''package''::text, ''article''::text, ''faq''::text])))'),
            ('ai_chat_documents', 'ai_chat_documents_title_size',
                'CHECK (((length(title) >= 1) AND (length(title) <= 500)))')
        ) as required(table_name, constraint_name, expected_definition)
    loop
        select pg_get_constraintdef(c.oid), c.convalidated
          into definition, is_validated
          from pg_constraint c
         where c.conrelid = format('healthcare.%s', expected.table_name)::regclass
           and c.conname = expected.constraint_name;
        if definition is null
           or not is_validated
           or regexp_replace(lower(definition), '\s+', '', 'g')
              <> regexp_replace(lower(expected.expected_definition), '\s+', '', 'g') then
            raise exception 'baseline healthcare.%.% constraint is missing or incompatible',
                expected.table_name, expected.constraint_name;
        end if;
    end loop;

    if not exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'healthcare.ai_chat_documents'::regclass
           and c.conname = 'ai_chat_documents_unique_source'
           and c.contype = 'u'
           and c.convalidated
           and regexp_replace(lower(pg_get_constraintdef(c.oid)), '\s+', '', 'g')
               = regexp_replace(lower('UNIQUE (projection_kind, source_type, source_id)'), '\s+', '', 'g')
    ) then
        raise exception 'baseline ai_chat_documents unique source contract is missing or incompatible';
    end if;
end
$projection_constraint_compatibility$;

do $catalog_constraints$
begin
    -- This is the owned named contract. Replace only this check after the
    -- preflight has proved every existing row is valid; any competing
    -- source_type check was rejected above. That makes the allowed set exact
    -- instead of accepting a drifted check merely because it mentions branch.
    alter table healthcare.ai_documents
        drop constraint if exists ai_documents_source_type;
    alter table healthcare.ai_documents
        add constraint ai_documents_source_type check (
            source_type in (
                'specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq'
            )
        ) not valid;
    alter table healthcare.ai_documents
        validate constraint ai_documents_source_type;

    if not exists (
        select 1 from pg_constraint
         where conrelid = 'healthcare.articles'::regclass
           and conname = 'articles_rich_content_shape'
    ) then
        alter table healthcare.articles
            add constraint articles_rich_content_shape check (
                content_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
                and audience in ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL')
                and jsonb_typeof(topic_tags) = 'array'
                and jsonb_typeof(key_takeaways) = 'array'
                and jsonb_typeof(warning_signs) = 'array'
                and jsonb_typeof(prevention_tips) = 'array'
                and jsonb_typeof(source_references) = 'array'
                and jsonb_typeof(clinical_metadata) = 'object'
                and pg_column_size(clinical_metadata) <= 65536
            ) not valid;
        alter table healthcare.articles
            validate constraint articles_rich_content_shape;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conrelid = 'healthcare.specialties'::regclass
           and conname = 'specialties_rich_content_shape'
    ) then
        alter table healthcare.specialties
            add constraint specialties_rich_content_shape check (
                jsonb_typeof(common_conditions) = 'array'
                and jsonb_typeof(red_flags) = 'array'
                and jsonb_typeof(preventive_care) = 'array'
                and jsonb_typeof(source_references) = 'array'
                and jsonb_typeof(clinical_metadata) = 'object'
                and pg_column_size(clinical_metadata) <= 65536
            ) not valid;
        alter table healthcare.specialties
            validate constraint specialties_rich_content_shape;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conrelid = 'healthcare.faqs'::regclass
           and conname = 'faqs_rich_content_shape'
    ) then
        alter table healthcare.faqs
            add constraint faqs_rich_content_shape check (
                audience in ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL')
                and jsonb_typeof(topic_tags) = 'array'
                and jsonb_typeof(source_references) = 'array'
                and jsonb_typeof(clinical_metadata) = 'object'
                and pg_column_size(clinical_metadata) <= 65536
                and sort_order >= 0
            ) not valid;
        alter table healthcare.faqs
            validate constraint faqs_rich_content_shape;
    end if;
end
$catalog_constraints$;

do $existing_index_compatibility$
declare
    expected record;
    definition text;
    is_valid boolean;
begin
    for expected in
        select * from (values
            ('healthcare_articles_rich_topic_tags_idx',
                'CREATE INDEX healthcare_articles_rich_topic_tags_idx ON healthcare.articles USING gin (topic_tags)'),
            ('healthcare_specialties_rich_conditions_idx',
                'CREATE INDEX healthcare_specialties_rich_conditions_idx ON healthcare.specialties USING gin (common_conditions)'),
            ('healthcare_faqs_rich_topic_tags_idx',
                'CREATE INDEX healthcare_faqs_rich_topic_tags_idx ON healthcare.faqs USING gin (topic_tags)'),
            ('healthcare_faqs_rich_related_specialty_idx',
                'CREATE INDEX healthcare_faqs_rich_related_specialty_idx ON healthcare.faqs USING btree (related_specialty_slug) WHERE active'),
            ('healthcare_ai_documents_branch_idx',
                'CREATE INDEX healthcare_ai_documents_branch_idx ON healthcare.ai_documents USING btree (source_type, source_id) WHERE ((source_type = ''branch''::text) AND active AND published AND (deleted_at IS NULL))'),
            ('ai_chat_documents_projection_cursor_idx',
                'CREATE INDEX ai_chat_documents_projection_cursor_idx ON healthcare.ai_chat_documents USING btree (projection_kind, updated_at DESC, id DESC)'),
            ('ai_chat_documents_branch_cursor_idx',
                'CREATE INDEX ai_chat_documents_branch_cursor_idx ON healthcare.ai_chat_documents USING btree (updated_at DESC, id DESC) WHERE ((projection_kind = ''OPERATIONAL''::text) AND (source_type = ''branch''::text))')
        ) as required(index_name, expected_definition)
    loop
        select i.indexdef, x.indisvalid and x.indisready
          into definition, is_valid
          from pg_indexes i
          join pg_class c on c.relname = i.indexname
          join pg_namespace n on n.oid = c.relnamespace and n.nspname = i.schemaname
          join pg_index x on x.indexrelid = c.oid
         where i.schemaname = 'healthcare'
           and i.indexname = expected.index_name;
        if definition is not null
           and (
               not is_valid
               or regexp_replace(lower(definition), '\s+', '', 'g')
                  <> regexp_replace(lower(expected.expected_definition), '\s+', '', 'g')
           ) then
            raise exception 'existing healthcare index % is incompatible', expected.index_name;
        end if;
    end loop;
end
$existing_index_compatibility$;

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

do $tombstone_column_compatibility$
declare
    existing_type text;
    existing_nullable text;
begin
    select c.data_type, c.is_nullable
      into existing_type, existing_nullable
      from information_schema.columns c
     where c.table_schema = 'healthcare'
       and c.table_name = 'ai_chat_documents'
       and c.column_name = 'tombstone_revision';
    if existing_type is not null
       and (existing_type <> 'bigint' or existing_nullable <> 'YES') then
        raise exception 'existing ai_chat_documents.tombstone_revision is incompatible';
    end if;
end
$tombstone_column_compatibility$;

alter table healthcare.ai_chat_documents
    add column if not exists tombstone_revision bigint;

update healthcare.ai_chat_documents
   set tombstone_revision = eligibility_revision
 where deleted_at is not null
   and tombstone_revision is null;

do $tombstone_constraint$
declare
    existing_definition text;
    is_validated boolean;
begin
    select pg_get_constraintdef(c.oid), c.convalidated
      into existing_definition, is_validated
      from pg_constraint c
     where c.conrelid = 'healthcare.ai_chat_documents'::regclass
       and c.conname = 'ai_chat_documents_tombstone_shape';
    if existing_definition is not null
       and (
           not is_validated
           or regexp_replace(lower(existing_definition), '\s+', '', 'g')
              <> regexp_replace(lower('CHECK ((((deleted_at IS NULL) AND (tombstone_revision IS NULL)) OR ((deleted_at IS NOT NULL) AND (tombstone_revision IS NOT NULL) AND (tombstone_revision > 0))))'), '\s+', '', 'g')
       ) then
        raise exception 'existing tombstone constraint is incompatible or unvalidated';
    end if;

    if not exists (
        select 1 from pg_constraint
         where conrelid = 'healthcare.ai_chat_documents'::regclass
           and conname = 'ai_chat_documents_tombstone_shape'
    ) then
        alter table healthcare.ai_chat_documents
            add constraint ai_chat_documents_tombstone_shape check (
                (deleted_at is null and tombstone_revision is null)
                or (
                    deleted_at is not null
                    and tombstone_revision is not null
                    and tombstone_revision > 0
                )
            ) not valid;
        alter table healthcare.ai_chat_documents
            validate constraint ai_chat_documents_tombstone_shape;
    end if;
end
$tombstone_constraint$;

create or replace function healthcare.ai_chat_documents_tombstone_guard()
returns trigger
language plpgsql
set search_path = healthcare, pg_catalog
as $function$
begin
    if new.deleted_at is not null then
        new.tombstone_revision := coalesce(new.tombstone_revision, new.eligibility_revision);
    else
        new.tombstone_revision := null;
    end if;

    if tg_op = 'UPDATE' then
        if new.eligibility_revision < old.eligibility_revision then
            raise exception 'projection eligibility revision cannot move backwards'
                using errcode = '40001';
        end if;

        if new.eligibility_revision = old.eligibility_revision
           and row(
               new.projection_kind, new.source_type, new.source_id,
               new.content_revision, new.content_hash, new.approval_round,
               new.approval_expires_at, new.title, new.content, new.metadata,
               new.embedding::text, new.embedding_model,
               new.embedding_provenance, new.active, new.published,
               new.deleted_at, new.tombstone_revision
           ) is distinct from row(
               old.projection_kind, old.source_type, old.source_id,
               old.content_revision, old.content_hash, old.approval_round,
               old.approval_expires_at, old.title, old.content, old.metadata,
               old.embedding::text, old.embedding_model,
               old.embedding_provenance, old.active, old.published,
               old.deleted_at, old.tombstone_revision
           ) then
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

    return new;
end
$function$;

drop trigger if exists ai_chat_documents_tombstone_guard
    on healthcare.ai_chat_documents;
create trigger ai_chat_documents_tombstone_guard
before insert or update on healthcare.ai_chat_documents
for each row execute function healthcare.ai_chat_documents_tombstone_guard();

create index if not exists ai_chat_documents_projection_cursor_idx
    on healthcare.ai_chat_documents(projection_kind, updated_at desc, id desc);
create index if not exists ai_chat_documents_branch_cursor_idx
    on healthcare.ai_chat_documents(updated_at desc, id desc)
    where projection_kind = 'OPERATIONAL' and source_type = 'branch';

create or replace function healthcare.list_chat_documents_page(
    projection_filter text default null,
    source_types_filter text[] default null,
    cursor_updated_at timestamptz default null,
    cursor_id uuid default null,
    page_size integer default 500,
    include_deleted boolean default true
)
returns table (
    id uuid, projection_kind text, source_type text, source_id text,
    content_revision bigint, eligibility_revision bigint, content_hash text,
    approval_round bigint, approval_expires_at timestamptz, title text,
    content text, metadata jsonb, embedding_model text,
    embedding_provenance text, active boolean, published boolean,
    deleted_at timestamptz, tombstone_revision bigint, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = healthcare, pg_catalog
as $function$
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
$function$;

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
    id uuid, source_type text, source_id text, title text, content text,
    metadata jsonb, projection_kind text, content_revision bigint,
    eligibility_revision bigint, content_hash text, approval_round bigint,
    approval_expires_at timestamptz, embedding_model text,
    embedding_provenance text, active boolean, published boolean,
    updated_at timestamptz, score real
)
language sql
stable
security invoker
set search_path = healthcare, extensions, pg_catalog
as $function$
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
$function$;

revoke create on schema healthcare from public;

alter table healthcare.ai_chat_documents enable row level security;
alter table healthcare.synthetic_seed_runs enable row level security;
alter table healthcare.synthetic_seed_chunks enable row level security;
alter table healthcare.customers enable row level security;
alter table healthcare.patient_profiles enable row level security;

revoke all privileges on table
    healthcare.ai_chat_documents,
    healthcare.synthetic_seed_runs,
    healthcare.synthetic_seed_chunks,
    healthcare.customers,
    healthcare.patient_profiles
from public, anon, authenticated;

grant all privileges on table
    healthcare.ai_chat_documents,
    healthcare.synthetic_seed_runs,
    healthcare.synthetic_seed_chunks
to service_role;

revoke all on function healthcare.ai_chat_documents_tombstone_guard()
from public, anon, authenticated;
revoke all on function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
) from public, anon, authenticated;
revoke all on function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
) from public, anon, authenticated;

grant execute on function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
) to service_role;
grant execute on function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
) to service_role;

do $platform_acl$
begin
    if to_regprocedure('public.rls_auto_enable()') is not null then
        execute 'revoke execute on function public.rls_auto_enable() '
            || 'from public, anon, authenticated, service_role';
        execute 'grant execute on function public.rls_auto_enable() to postgres';
        execute 'comment on function public.rls_auto_enable() is '
            || quote_literal('Internal DDL event trigger; execution is restricted to postgres.');
    end if;
end
$platform_acl$;

comment on column healthcare.ai_chat_documents.tombstone_revision is
    'Database-owned ineligibility revision; equal/older work cannot resurrect a tombstone.';
comment on function healthcare.list_chat_documents_page(
    text, text[], timestamptz, uuid, integer, boolean
) is 'Service-only keyset page for projection reconciliation; never exposes patient/history identities.';
comment on function healthcare.match_chat_documents_page(
    extensions.vector, real, integer, text[], text, real, uuid
) is 'Service-only vector keyset page; Spring remains the final clinical authorization authority.';

do $postconditions$
declare
    list_page_oid oid;
    match_page_oid oid;
    platform_helper_oid oid;
begin
    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'ai_chat_documents'
           and column_name = 'tombstone_revision'
    ) then
        raise exception 'tombstone_revision reconciliation postcondition failed';
    end if;

    if not exists (
        select 1 from pg_trigger
         where tgrelid = 'healthcare.ai_chat_documents'::regclass
           and tgname = 'ai_chat_documents_tombstone_guard'
           and not tgisinternal
    ) then
        raise exception 'tombstone guard reconciliation postcondition failed';
    end if;

    select to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    ) into list_page_oid;
    select to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    ) into match_page_oid;

    if list_page_oid is null or match_page_oid is null then
        raise exception 'projection pagination function postcondition failed';
    end if;

    if has_function_privilege('anon', list_page_oid, 'EXECUTE')
       or has_function_privilege('authenticated', list_page_oid, 'EXECUTE')
       or has_function_privilege('anon', match_page_oid, 'EXECUTE')
       or has_function_privilege('authenticated', match_page_oid, 'EXECUTE') then
        raise exception 'browser role can execute a service-only projection function';
    end if;

    if not has_function_privilege('service_role', list_page_oid, 'EXECUTE')
       or not has_function_privilege('service_role', match_page_oid, 'EXECUTE') then
        raise exception 'service_role projection function grant postcondition failed';
    end if;

    if has_table_privilege('anon', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('anon', 'healthcare.customers', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.patient_profiles', 'SELECT') then
        raise exception 'browser role can read a server-only healthcare table';
    end if;

    select to_regprocedure('public.rls_auto_enable()') into platform_helper_oid;
    if platform_helper_oid is not null and (
        has_function_privilege('anon', platform_helper_oid, 'EXECUTE')
        or has_function_privilege('authenticated', platform_helper_oid, 'EXECUTE')
        or has_function_privilege('service_role', platform_helper_oid, 'EXECUTE')
    ) then
        raise exception 'platform event-trigger helper remains externally executable';
    end if;
end
$postconditions$;

commit;
