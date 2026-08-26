begin;

-- The event trigger is invoked by PostgreSQL for DDL; it is not a Data API
-- function.  Remove the default PUBLIC grant so anon/authenticated/service_role
-- cannot call the SECURITY DEFINER function through a public RPC surface. Some
-- fresh/local projects do not install this platform-managed helper, so guard
-- the hardening operation instead of making a fresh migration fail.
do $migration$
begin
    if to_regprocedure('public.rls_auto_enable()') is not null then
        execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role';
        execute 'grant execute on function public.rls_auto_enable() to postgres';
        execute 'comment on function public.rls_auto_enable() is '
            || quote_literal('Internal DDL event trigger; execution is restricted to postgres.');
    end if;
end
$migration$;

commit;
