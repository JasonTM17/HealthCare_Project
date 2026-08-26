-- Read-only structural and security gate for the additive projection migration.
-- Run against a disposable local Supabase database after `supabase db reset`.

begin;
set local statement_timeout = '2min';

do $$
declare
    table_oid oid;
    row_count bigint;
begin
    table_oid := to_regclass('healthcare.ai_chat_documents');
    if table_oid is null then
        raise exception 'healthcare.ai_chat_documents is missing';
    end if;

    if not exists (
        select 1 from pg_attribute
         where attrelid = table_oid
           and attname = 'tombstone_revision'
           and not attisdropped
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

    select count(*) into row_count
      from pg_attribute a
     where a.attrelid = table_oid
       and not a.attisdropped
       and a.attname in ('patient_id', 'user_id', 'conversation_id', 'message_id');
    if row_count <> 0 then
        raise exception 'projection contains patient/history identity columns';
    end if;

    if not exists (
        select 1 from pg_indexes
         where schemaname = 'healthcare'
           and indexname = 'ai_chat_documents_projection_cursor_idx'
    ) then
        raise exception 'projection cursor index is missing';
    end if;

    if to_regprocedure(
        'healthcare.list_chat_documents_page(text,text[],timestamptz,uuid,integer,boolean)'
    ) is null then
        raise exception 'list_chat_documents_page RPC is missing';
    end if;
    if to_regprocedure(
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)'
    ) is null then
        raise exception 'match_chat_documents_page RPC is missing';
    end if;

    if has_function_privilege(
        'anon',
        'healthcare.list_chat_documents_page(text,text[],timestamptz,uuid,integer,boolean)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'healthcare.list_chat_documents_page(text,text[],timestamptz,uuid,integer,boolean)',
        'EXECUTE'
    ) then
        raise exception 'browser role can execute list_chat_documents_page';
    end if;
    if has_function_privilege(
        'anon',
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'healthcare.match_chat_documents_page(extensions.vector,real,integer,text[],text,real,uuid)',
        'EXECUTE'
    ) then
        raise exception 'browser role can execute match_chat_documents_page';
    end if;
end;
$$;

insert into healthcare.ai_chat_documents (
    projection_kind,
    source_type,
    source_id,
    content_revision,
    eligibility_revision,
    content_hash,
    approval_round,
    approval_expires_at,
    title,
    content,
    metadata,
    active,
    published
) values (
    'CLINICAL',
    'article',
    'contract-equal-revision-test',
    1,
    7,
    repeat('a', 64),
    1,
    current_timestamp + interval '30 days',
    'Synthetic contract fixture',
    'Synthetic approved content',
    '{"approval_id":"round-1"}'::jsonb,
    true,
    true
);

-- An exact no-op replay may touch updated_at but cannot change authoritative
-- projection state at the same eligibility revision.
update healthcare.ai_chat_documents
   set metadata = metadata
 where projection_kind = 'CLINICAL'
   and source_type = 'article'
   and source_id = 'contract-equal-revision-test';

do $$
begin
    begin
        update healthcare.ai_chat_documents
           set approval_expires_at = approval_expires_at + interval '365 days'
         where projection_kind = 'CLINICAL'
           and source_type = 'article'
           and source_id = 'contract-equal-revision-test';
        raise exception 'equal-revision approval expiry drift was accepted';
    exception
        when serialization_failure then
            null;
    end;

    begin
        update healthcare.ai_chat_documents
           set metadata = jsonb_set(metadata, '{approval_id}', '"round-2"'::jsonb)
         where projection_kind = 'CLINICAL'
           and source_type = 'article'
           and source_id = 'contract-equal-revision-test';
        raise exception 'equal-revision approval metadata drift was accepted';
    exception
        when serialization_failure then
            null;
    end;
end;
$$;

rollback;
