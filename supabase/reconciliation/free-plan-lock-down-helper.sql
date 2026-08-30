-- One-time emergency hardening for the Supabase-managed DDL event-trigger
-- helper. It is safe whether the reconciliation projection is present or
-- rolled back; it changes no healthcare data or migration history directly.
--
-- This is an exact operation for the named cluster only. Verify the Supabase
-- URL/ref through the management API first; the SQL binds the session to the
-- captured PostgreSQL system_identifier and the six-row pre-lockdown history.
-- It is intentionally not re-runnable after its own audit row is recorded;
-- obtain a new exact-state capsule for any later helper change.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = pg_catalog, extensions;

do $lock_down_helper$
declare
    system_identifier text;
    history text[];
    helper_oid oid;
begin
    select pcs.system_identifier::text into system_identifier from pg_control_system() pcs;
    if system_identifier <> '7666007964130682852' then
        raise exception 'PostgreSQL system identifier does not match the named Supabase target';
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
        '20260830075737:rollback_free_plan_reconciliation_20260830'
    ]::text[] then
        raise exception 'helper lockdown history is not the exact observed six-row state';
    end if;
    select p.oid into helper_oid
      from pg_proc p
     where p.oid = to_regprocedure('public.rls_auto_enable()')
       and pg_get_userbyid(p.proowner) = 'postgres'
       and coalesce(p.proacl::text, '<NULL>')
           = '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
       and obj_description(p.oid, 'pg_proc') is null;
    if helper_oid is null then
        raise exception 'public.rls_auto_enable() is missing';
    end if;
    execute 'revoke execute on function public.rls_auto_enable() '
        || 'from public, anon, authenticated, service_role';
    execute 'grant execute on function public.rls_auto_enable() to postgres';
    execute 'comment on function public.rls_auto_enable() is '
        || quote_literal('Internal DDL event trigger; execution is restricted to postgres.');
end
$lock_down_helper$;

do $lock_down_helper_postcondition$
declare
    helper_oid oid := to_regprocedure('public.rls_auto_enable()');
begin
    if helper_oid is null
       or has_function_privilege('anon', helper_oid, 'EXECUTE')
       or has_function_privilege('authenticated', helper_oid, 'EXECUTE')
       or has_function_privilege('service_role', helper_oid, 'EXECUTE')
       or not has_function_privilege('postgres', helper_oid, 'EXECUTE')
       or obj_description(helper_oid, 'pg_proc') is distinct from
           'Internal DDL event trigger; execution is restricted to postgres.'
       or pg_get_userbyid((select proowner from pg_proc where oid = helper_oid)) <> 'postgres'
       or coalesce((select proacl::text from pg_proc where oid = helper_oid), '<NULL>')
           <> '{postgres=X/postgres}' then
        raise exception 'platform helper hardening postcondition failed';
    end if;
end
$lock_down_helper_postcondition$;

commit;
