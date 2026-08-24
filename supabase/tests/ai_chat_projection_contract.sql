-- Read-only structural gate for the protected patient-chat projection.
-- Run after `supabase db reset`; the transaction is rolled back.

begin;
set local statement_timeout = '2min';

do $$
declare
    table_oid oid;
    row_count bigint;
    privilege_name text;
begin
    table_oid := to_regclass('healthcare.ai_chat_documents');
    if table_oid is null then
        raise exception 'healthcare.ai_chat_documents is missing';
    end if;

    if not exists (
        select 1
        from pg_class
        where oid = table_oid
          and relrowsecurity
    ) then
        raise exception 'RLS is not enabled on healthcare.ai_chat_documents';
    end if;

    select count(*) into row_count
    from pg_policies
    where schemaname = 'healthcare'
      and tablename = 'ai_chat_documents';
    if row_count <> 0 then
        raise exception 'patient-chat projection must not expose browser policies: %', row_count;
    end if;

    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
        if has_table_privilege('anon', 'healthcare.ai_chat_documents', privilege_name)
           or has_table_privilege('authenticated', 'healthcare.ai_chat_documents', privilege_name)
        then
            raise exception 'browser role has % on ai_chat_documents', privilege_name;
        end if;
    end loop;

    foreach privilege_name in array array[
        'projection_kind', 'source_type', 'source_id', 'content_revision',
        'eligibility_revision', 'content_hash', 'approval_round',
        'approval_expires_at', 'content', 'embedding'
    ]
    loop
        if not exists (
            select 1
            from information_schema.columns
            where table_schema = 'healthcare'
              and table_name = 'ai_chat_documents'
              and column_name = privilege_name
        ) then
            raise exception 'ai_chat_documents column is missing: %', privilege_name;
        end if;
    end loop;

    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'healthcare'
          and indexname = 'ai_chat_documents_embedding_hnsw_idx'
    ) then
        raise exception 'patient-chat projection HNSW index is missing';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = table_oid
          and conname = 'ai_chat_documents_approval_metadata'
    ) then
        raise exception 'clinical approval metadata constraint is missing';
    end if;

    if to_regprocedure(
        'healthcare.match_chat_documents(extensions.vector,real,integer,text[],text)'
    ) is null then
        raise exception 'protected match_chat_documents RPC is missing';
    end if;

    if has_function_privilege(
        'anon',
        'healthcare.match_chat_documents(extensions.vector,real,integer,text[],text)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'healthcare.match_chat_documents(extensions.vector,real,integer,text[],text)',
        'EXECUTE'
    ) then
        raise exception 'browser role can execute match_chat_documents';
    end if;

    select count(*) into row_count
    from information_schema.columns
    where table_schema = 'healthcare'
      and table_name = 'ai_chat_documents'
      and column_name in ('patient_id', 'user_id', 'conversation_id', 'message_id');
    if row_count <> 0 then
        raise exception 'patient-chat projection contains patient/history identity columns';
    end if;
end;
$$;

rollback;
