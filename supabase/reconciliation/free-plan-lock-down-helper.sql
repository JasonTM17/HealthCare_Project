-- Idempotent emergency hardening for the Supabase-managed DDL event-trigger
-- helper. This is safe whether the reconciliation projection is present or
-- rolled back; it changes no healthcare data or migration history directly.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $lock_down_helper$
begin
    if to_regprocedure('public.rls_auto_enable()') is null then
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
    if has_function_privilege('anon', helper_oid, 'EXECUTE')
       or has_function_privilege('authenticated', helper_oid, 'EXECUTE')
       or has_function_privilege('service_role', helper_oid, 'EXECUTE')
       or not has_function_privilege('postgres', helper_oid, 'EXECUTE')
       or obj_description(helper_oid, 'pg_proc')
          <> 'Internal DDL event trigger; execution is restricted to postgres.' then
        raise exception 'platform helper hardening postcondition failed';
    end if;
end
$lock_down_helper_postcondition$;

commit;
