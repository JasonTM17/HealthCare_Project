-- Read-only structural gate for the scalable synthetic/vector slice.
-- Run after migrations and the configured seed. The transaction is rolled back.

begin;
set local statement_timeout = '2min';

do $$
declare
    row_count bigint;
    rls_enabled boolean;
    table_name text;
    privilege_name text;
begin
    foreach table_name in array array['synthetic_seed_runs', 'synthetic_seed_chunks']
    loop
        if to_regclass('healthcare.' || table_name) is null then
            raise exception 'synthetic checkpoint table is missing: healthcare.%', table_name;
        end if;

        select c.relrowsecurity into rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'healthcare' and c.relname = table_name;
        if coalesce(rls_enabled, false) is not true then
            raise exception 'RLS is not enabled on healthcare.%', table_name;
        end if;

        foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        loop
            if has_table_privilege('anon', 'healthcare.' || table_name, privilege_name)
               or has_table_privilege('authenticated', 'healthcare.' || table_name, privilege_name) then
                raise exception 'browser role has % on healthcare.%', privilege_name, table_name;
            end if;
        end loop;
    end loop;

    if not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'healthcare'
          and c.table_name = 'ai_documents'
          and c.column_name = 'embedding_dimension'
          and c.data_type = 'smallint'
    ) then
        raise exception 'ai_documents.embedding_dimension contract is missing';
    end if;

    if not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'healthcare'
          and c.table_name = 'ai_documents'
          and c.column_name = 'published_at'
    ) then
        raise exception 'ai_documents.published_at contract is missing';
    end if;

    foreach table_name in array array[
        'ai_documents_embedding_dimension_check',
        'ai_documents_embedding_shape_check',
        'ai_documents_content_hash_format_check',
        'ai_documents_sync_revision_check',
        'ai_documents_embedding_model_check',
        'ai_documents_published_at_check'
    ]
    loop
        if not exists (
            select 1 from pg_constraint
            where conrelid = 'healthcare.ai_documents'::regclass
              and conname = table_name
        ) then
            raise exception 'vector contract constraint is missing: %', table_name;
        end if;
    end loop;

    foreach table_name in array array[
        'ai_documents_embedding_profile_idx',
        'ai_documents_content_hash_idx',
        'ai_documents_published_at_idx',
        'synthetic_seed_runs_status_idx',
        'synthetic_seed_chunks_pending_idx'
    ]
    loop
        if not exists (
            select 1 from pg_indexes
            where schemaname = 'healthcare' and indexname = table_name
        ) then
            raise exception 'required index is missing: %', table_name;
        end if;
    end loop;

    select count(*) into row_count
    from healthcare.ai_documents
    where embedding_dimension <> 384
       or (embedding is not null and extensions.vector_dims(embedding) <> 384)
       or content_hash !~ '^[0-9a-f]{64}$'
       or sync_revision < 0
       or (published and published_at is null);
    if row_count <> 0 then
        raise exception 'existing vector rows violate the 384/hash/revision/publication contract: %', row_count;
    end if;

    select count(*) into row_count
    from healthcare.ai_documents
    where source_id like 'synthetic-article-%'
      and (
          metadata->>'synthetic' <> 'true'
          or embedding_model <> 'local-hash'
          or embedding_provenance <> 'local_provider'
      );
    if row_count <> 0 then
        raise exception 'generated public RAG rows contain non-synthetic or incompatible provenance: %', row_count;
    end if;
end;
$$;

rollback;
