-- Spring Boot/PostgreSQL remains the sole authority for accounts and patient
-- identity. Supabase keeps a server-managed synthetic mirror for analytics and
-- catalog/RAG workflows; browser roles must not access that mirror directly.

drop policy if exists customers_self_read on healthcare.customers;
drop policy if exists customers_self_insert on healthcare.customers;
drop policy if exists customers_self_update on healthcare.customers;
drop policy if exists customers_admin_delete on healthcare.customers;

drop policy if exists patient_profiles_self_read on healthcare.patient_profiles;
drop policy if exists patient_profiles_self_insert on healthcare.patient_profiles;
drop policy if exists patient_profiles_self_update on healthcare.patient_profiles;
drop policy if exists patient_profiles_admin_delete on healthcare.patient_profiles;

drop function if exists healthcare.is_admin();
drop index if exists healthcare.customers_auth_user_id_idx;

alter table healthcare.customers
    drop constraint if exists customers_auth_user_id_fkey,
    alter column synthetic set default true;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.customers'::regclass
          and conname = 'customers_synthetic_only'
    ) then
        alter table healthcare.customers
            add constraint customers_synthetic_only check (synthetic);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'healthcare.customers'::regclass
          and conname = 'customers_no_supabase_auth_link'
    ) then
        alter table healthcare.customers
            add constraint customers_no_supabase_auth_link check (auth_user_id is null);
    end if;
end;
$$;

revoke all privileges on healthcare.customers from anon, authenticated;
revoke all privileges on healthcare.patient_profiles from anon, authenticated;

comment on table healthcare.customers is
    'Server-managed synthetic customer mirror; Spring PostgreSQL is the identity authority';
comment on column healthcare.customers.auth_user_id is
    'Null-only seed compatibility field; never an authentication, correlation, or authorization link';
comment on table healthcare.patient_profiles is
    'Server-managed synthetic profile mirror; never exposed directly to browser roles';
