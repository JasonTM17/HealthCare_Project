-- Read-only post-apply gate for the hosted reconciliation migration.
-- Run only after the exact target/ref and migration version are confirmed.

do $contract$
declare
    table_oid oid;
    list_page_oid oid;
    match_page_oid oid;
    platform_helper_oid oid;
begin
    table_oid := to_regclass('healthcare.ai_chat_documents');
    if table_oid is null then
        raise exception 'healthcare.ai_chat_documents is missing';
    end if;

    if not exists (
        select 1 from pg_class where oid = table_oid and relrowsecurity
    ) then
        raise exception 'RLS is not enabled on healthcare.ai_chat_documents';
    end if;

    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'healthcare'
           and table_name = 'ai_chat_documents'
           and column_name = 'tombstone_revision'
    ) then
        raise exception 'tombstone_revision is missing';
    end if;

    if not exists (
        select 1 from pg_trigger
         where tgrelid = table_oid
           and tgname = 'ai_chat_documents_tombstone_guard'
           and not tgisinternal
    ) then
        raise exception 'tombstone guard trigger is missing';
    end if;

    if not exists (
        select 1 from pg_constraint
         where conrelid = table_oid
           and conname = 'ai_chat_documents_tombstone_shape'
    ) then
        raise exception 'tombstone shape constraint is missing';
    end if;

    if not exists (
        select 1 from pg_indexes
         where schemaname = 'healthcare'
           and tablename = 'ai_chat_documents'
           and indexname = 'ai_chat_documents_projection_cursor_idx'
    ) then
        raise exception 'projection cursor index is missing';
    end if;

    list_page_oid := to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamp with time zone,uuid,integer,boolean)'
    );
    match_page_oid := to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    );

    if list_page_oid is null or match_page_oid is null then
        raise exception 'projection pagination function is missing';
    end if;

    if has_function_privilege('anon', list_page_oid, 'EXECUTE')
       or has_function_privilege('authenticated', list_page_oid, 'EXECUTE')
       or has_function_privilege('anon', match_page_oid, 'EXECUTE')
       or has_function_privilege('authenticated', match_page_oid, 'EXECUTE') then
        raise exception 'browser role can execute a service-only projection function';
    end if;

    if not has_function_privilege('service_role', list_page_oid, 'EXECUTE')
       or not has_function_privilege('service_role', match_page_oid, 'EXECUTE') then
        raise exception 'service_role projection function privilege is missing';
    end if;

    if has_table_privilege('anon', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.ai_chat_documents', 'SELECT')
       or has_table_privilege('anon', 'healthcare.customers', 'SELECT')
       or has_table_privilege('authenticated', 'healthcare.patient_profiles', 'SELECT') then
        raise exception 'browser role can read a server-only healthcare table';
    end if;

    platform_helper_oid := to_regprocedure('public.rls_auto_enable()');
    if platform_helper_oid is not null and (
        has_function_privilege('anon', platform_helper_oid, 'EXECUTE')
        or has_function_privilege('authenticated', platform_helper_oid, 'EXECUTE')
        or has_function_privilege('service_role', platform_helper_oid, 'EXECUTE')
    ) then
        raise exception 'public.rls_auto_enable remains externally executable';
    end if;
end
$contract$;
