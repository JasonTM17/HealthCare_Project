-- Legacy columns remain the published/legacy snapshot. Private draft saves do
-- not overwrite them, so rollback cannot disclose an unpublished draft.
ALTER TABLE cms_contents
    ADD COLUMN draft_component_type VARCHAR(40),
    ADD COLUMN draft_payload JSONB,
    ADD COLUMN draft_updated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN public_revision BIGINT,
    ADD COLUMN public_updated_at TIMESTAMP WITH TIME ZONE;

UPDATE cms_contents
SET public_revision = version, public_updated_at = updated_at
WHERE status = 'PUBLISHED';

-- Exact canonical route families and UUID-bound detail families mirror the
-- reviewed native manifest. Existing legacy route/slot/type combinations stay
-- restricted; PAGE_LAYOUT can never be stored in a hero/body/sidebar/footer.
CREATE FUNCTION cms_page_slot_component_valid(slot TEXT, component TEXT)
RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE
AS $contract$
    SELECT
        (
            slot ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu)\.(hero|body|sidebar|footer)$'
            AND (
                component IS NULL
                OR (split_part(slot, '.', 2) = 'hero' AND component = 'HERO')
                OR (split_part(slot, '.', 2) = 'body' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
                OR (split_part(slot, '.', 2) = 'sidebar' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
                OR (split_part(slot, '.', 2) = 'footer' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
            )
        )
        OR (
            (
                slot ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu|benh-pho-bien|gop-y|chinh-sach-bao-mat)\.layout$'
                OR slot ~ '^(branches|specialties|doctors|services|packages|articles|benh-pho-bien)\.detail-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.layout$'
            )
            AND (component IS NULL OR component = 'PAGE_LAYOUT')
        );
$contract$;

ALTER TABLE cms_contents
    DROP CONSTRAINT ck_cms_contents_component_type,
    DROP CONSTRAINT ck_cms_contents_public_slot_key,
    DROP CONSTRAINT ck_cms_contents_slot_component_type,
    ADD CONSTRAINT ck_cms_contents_component_type CHECK (
        component_type IN ('HERO', 'RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD', 'PAGE_LAYOUT')
    ),
    ADD CONSTRAINT ck_cms_contents_public_slot_key CHECK (cms_page_slot_component_valid(slot_key, component_type)),
    ADD CONSTRAINT ck_cms_contents_private_draft CHECK (
        (draft_component_type IS NULL AND draft_payload IS NULL AND draft_updated_at IS NULL)
        OR (
            draft_component_type IS NOT NULL AND draft_payload IS NOT NULL AND draft_updated_at IS NOT NULL
            AND cms_page_slot_component_valid(slot_key, draft_component_type)
            AND jsonb_typeof(draft_payload) = 'object' AND pg_column_size(draft_payload) <= 32768
        )
    ),
    ADD CONSTRAINT ck_cms_contents_public_metadata CHECK (
        (public_revision IS NULL AND public_updated_at IS NULL)
        OR (public_revision IS NOT NULL AND public_revision > 0 AND public_revision <= version AND public_updated_at IS NOT NULL)
    );

ALTER TABLE cms_content_changes
    DROP CONSTRAINT ck_cms_content_changes_component_type,
    DROP CONSTRAINT ck_cms_content_changes_public_slot_key,
    DROP CONSTRAINT ck_cms_content_changes_slot_component_type,
    ADD CONSTRAINT ck_cms_content_changes_component_type CHECK (
        component_type IS NULL OR component_type IN ('HERO', 'RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD', 'PAGE_LAYOUT')
    ),
    ADD CONSTRAINT ck_cms_content_changes_public_slot_key CHECK (cms_page_slot_component_valid(slot_key, component_type));
