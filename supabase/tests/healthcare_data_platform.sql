-- Read-only smoke gate. Run after `supabase db reset` and the configured seed.
-- The transaction is rolled back so the check cannot mutate the local database.

begin;
set local statement_timeout = '2min';

do $$
declare
    row_count bigint;
    rls_enabled boolean;
    table_name text;
    browser_role text;
    privilege_name text;
begin
    if not exists (select 1 from pg_extension where extname = 'vector') then
        raise exception 'pgvector extension is missing';
    end if;

    if to_regclass('healthcare.ai_documents') is null
       or to_regclass('healthcare.customers') is null
       or to_regclass('healthcare.patient_profiles') is null then
        raise exception 'required healthcare tables are missing';
    end if;

    select count(*) into row_count
    from pg_tables
    where schemaname = 'healthcare'
      and tablename ~ '(chat|conversation|message)';
    if row_count <> 0 then
        raise exception 'patient chat history tables must stay in Spring PostgreSQL: % found', row_count;
    end if;

    foreach table_name in array array['ai_documents', 'customers', 'patient_profiles']
    loop
        select c.relrowsecurity into rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'healthcare'
          and c.relname = table_name;
        if coalesce(rls_enabled, false) is not true then
            raise exception 'RLS is not enabled on healthcare.%', table_name;
        end if;
    end loop;

    select count(*) into row_count
    from pg_constraint fk
    join pg_class source_table on source_table.oid = fk.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = fk.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where fk.contype = 'f'
      and source_schema.nspname = 'healthcare'
      and source_table.relname in ('customers', 'patient_profiles')
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users';
    if row_count <> 0 then
        raise exception 'synthetic mirrors must not reference the Supabase Auth user table';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.customers'::regclass
          and conname = 'customers_no_supabase_auth_link'
    ) then
        raise exception 'null-only Supabase Auth compatibility constraint is missing';
    end if;

    select count(*) into row_count
    from pg_policies
    where schemaname = 'healthcare'
      and tablename in ('customers', 'patient_profiles');
    if row_count <> 0 then
        raise exception 'server-only customer and patient mirrors must not have browser policies: % found', row_count;
    end if;

    foreach browser_role in array array['anon', 'authenticated']
    loop
        foreach table_name in array array['customers', 'patient_profiles']
        loop
            foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
            loop
                if has_table_privilege(
                    browser_role,
                    'healthcare.' || table_name,
                    privilege_name
                ) then
                    raise exception 'browser role % has % on healthcare.%',
                        browser_role, privilege_name, table_name;
                end if;
            end loop;
        end loop;
    end loop;

    if not exists (
        select 1 from pg_indexes
        where schemaname = 'healthcare'
          and indexname = 'ai_documents_embedding_hnsw_idx'
    ) then
        raise exception 'HNSW vector index is missing';
    end if;

    if not exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'healthcare'
          and p.proname = 'match_documents'
          and p.pronargs = 5
    ) then
        raise exception 'hybrid match_documents RPC is missing';
    end if;

    select count(*) into row_count from healthcare.specialties;
    if row_count < 30 then raise exception 'specialty seed is incomplete: %', row_count; end if;
    select count(*) into row_count from healthcare.doctors;
    if row_count < 500 then raise exception 'doctor seed is incomplete: %', row_count; end if;
    select count(*) into row_count from healthcare.customers;
    if row_count < 10000 then raise exception 'customer seed is incomplete: %', row_count; end if;
    select count(*) into row_count
    from healthcare.customers
    where synthetic is not true
       or auth_user_id is not null
       or legacy_user_id is null
       or customer_code !~ '^KH-[0-9]{6}$'
       or email is null
       or email !~ '^[a-z0-9]+@healthcare[.]local$';
    if row_count <> 0 then raise exception 'customer seed violates the synthetic-only contract: %', row_count; end if;
    select count(*) into row_count from healthcare.patient_profiles;
    if row_count < 7500 then raise exception 'patient seed is incomplete: %', row_count; end if;
    select count(*) into row_count
    from healthcare.patient_profiles p
    left join healthcare.customers c on c.id = p.customer_id
    where c.id is null or c.synthetic is not true or c.auth_user_id is not null;
    if row_count <> 0 then raise exception 'patient seed is not linked exclusively to synthetic customers: %', row_count; end if;
    select count(*) into row_count from healthcare.ai_documents;
    if row_count < 1480 then raise exception 'RAG seed is incomplete: %', row_count; end if;

    select count(*) into row_count
    from (
        select source_type, source_id
        from healthcare.ai_documents
        group by source_type, source_id
        having count(*) > 1
    ) duplicates;
    if row_count <> 0 then raise exception 'duplicate RAG source identities found: %', row_count; end if;

    select count(*) into row_count
    from healthcare.ai_documents
    where source_type not in ('specialty', 'doctor', 'service', 'package', 'article', 'faq')
       or content_hash !~ '^[0-9a-f]{64}$'
       or sync_revision < 0;
    if row_count <> 0 then raise exception 'RAG rows violate public catalog provenance: %', row_count; end if;
end;
$$;

rollback;
