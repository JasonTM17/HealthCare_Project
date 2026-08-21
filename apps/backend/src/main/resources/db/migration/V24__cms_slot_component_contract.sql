ALTER TABLE cms_contents
    ADD CONSTRAINT ck_cms_contents_slot_component_type
    CHECK (
        (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
        OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
        OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
    );

ALTER TABLE cms_content_changes
    ADD CONSTRAINT ck_cms_content_changes_slot_component_type
    CHECK (
        component_type IS NULL
        OR (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
        OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
        OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
    );
